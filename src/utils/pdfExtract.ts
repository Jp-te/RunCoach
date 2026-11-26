import type { PdfLine } from '../types/plan';
import { itemsToLines, ocrWordsToItems, type OcrWord } from './planParser';

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_PDF_PAGES = 30;
const MAX_OCR_PAGES = 12;
const A4_WIDTH_PT = 595;

export interface ExtractResult {
  lines: PdfLine[];
  /** true quando o texto veio de reconhecimento óptico (OCR) e não do texto do PDF. */
  ocr: boolean;
}
export type Progress = (message: string, fraction?: number) => void;

const isImage = (f: File) => /^image\/(png|jpe?g|webp)$/.test(f.type) || /\.(png|jpe?g|webp)$/i.test(f.name);

async function loadPdf(file: File) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  if (doc.numPages > MAX_PDF_PAGES) throw new Error(`O PDF tem páginas demais (máximo ${MAX_PDF_PAGES}).`);
  return doc;
}

/** Texto do próprio PDF (rápido e exato). */
async function readTextLayer(doc: Awaited<ReturnType<typeof loadPdf>>): Promise<PdfLine[]> {
  const lines: PdfLine[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const items = tc.items
      .filter((it): it is Extract<typeof it, { str: string }> => 'str' in it)
      .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width }));
    lines.push(...itemsToLines(items, p));
  }
  return lines;
}

async function makeWorker(onProgress: Progress) {
  const { createWorker } = await import('tesseract.js');
  const base = new URL(`${import.meta.env.BASE_URL}ocr/`, document.baseURI).href;
  return createWorker('por', 1, {
    workerPath: `${base}worker.min.js`,
    corePath: `${base}core`,
    langPath: `${base}lang`,
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress('Reconhecendo o texto (OCR)…', m.progress);
    },
  });
}

async function canvasToBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Falha ao preparar a imagem.'))), 'image/png'));
}

/**
 * Pré-processamento: tons de cinza com contraste e, nas faixas coloridas (cabeçalhos de tabela
 * com texto branco sobre laranja/azul etc.), inverte para texto escuro sobre fundo claro —
 * o OCR lê muito melhor assim.
 */
function enhance(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    let colored = 0;
    for (let x = 0; x < w; x += 4) {
      const i = (y * w + x) * 4;
      if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 70) colored++;
    }
    const band = colored / Math.ceil(w / 4) > 0.3;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const sat = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      let v: number;
      if (band) v = sat > 70 || g < 170 ? 255 : 0; // fundo colorido -> branco; texto claro -> preto
      else v = Math.max(0, Math.min(255, (g - 128) * 1.35 + 128));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }
  ctx.putImageData(img, 0, 0);
}

type Worker = Awaited<ReturnType<typeof makeWorker>>;
type Recognized = Awaited<ReturnType<Worker['recognize']>>;
const wordsOf = (r: Recognized): OcrWord[] => (r.data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)));

/** Inclinação mediana (graus) das linhas de texto lidas — fotos tiradas tortas. */
function skewDegrees(r: Recognized): number {
  const angles = (r.data.blocks ?? [])
    .flatMap((b) => b.paragraphs.flatMap((p) => p.lines))
    .filter((l) => l.baseline && l.bbox.x1 - l.bbox.x0 > 250)
    .map((l) => (Math.atan2(l.baseline.y1 - l.baseline.y0, l.baseline.x1 - l.baseline.x0) * 180) / Math.PI)
    .sort((a, b) => a - b);
  return angles.length >= 3 ? angles[Math.floor(angles.length / 2)] : 0;
}

function rotated(src: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((-degrees * Math.PI) / 180);
  ctx.drawImage(src, -c.width / 2, -c.height / 2);
  return c;
}

async function ocrCanvas(worker: Worker, canvas: HTMLCanvasElement, page: number): Promise<PdfLine[]> {
  enhance(canvas);
  let r = await worker.recognize(await canvasToBlob(canvas), {}, { blocks: true });
  const skew = skewDegrees(r);
  if (Math.abs(skew) > 0.3 && Math.abs(skew) < 15) {
    // endireita a imagem e lê de novo (linhas tortas quebram as colunas da tabela)
    canvas = rotated(canvas, skew);
    r = await worker.recognize(await canvasToBlob(canvas), {}, { blocks: true });
  }
  const scale = canvas.width / A4_WIDTH_PT; // trata a largura da imagem como uma página A4
  return itemsToLines(ocrWordsToItems(wordsOf(r), scale), page, 7);
}

async function ocrImageFile(file: File, onProgress: Progress): Promise<PdfLine[]> {
  onProgress('Preparando a imagem…');
  const bmp = await createImageBitmap(file);
  const target = Math.min(2400, Math.max(1500, bmp.width)); // largura-alvo: nem pequena demais, nem enorme
  const canvas = document.createElement('canvas');
  canvas.width = target;
  canvas.height = Math.round((bmp.height * canvas.width) / bmp.width);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  onProgress('Carregando o reconhecedor de texto…');
  const worker = await makeWorker(onProgress);
  try {
    return await ocrCanvas(worker, canvas, 1);
  } finally {
    await worker.terminate();
  }
}

async function ocrPdf(doc: Awaited<ReturnType<typeof loadPdf>>, onProgress: Progress): Promise<PdfLine[]> {
  if (doc.numPages > MAX_OCR_PAGES) throw new Error(`PDF escaneado com páginas demais para o OCR (máximo ${MAX_OCR_PAGES}).`);
  onProgress('Carregando o reconhecedor de texto…');
  const worker = await makeWorker(onProgress);
  const lines: PdfLine[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      onProgress(`Lendo a página ${p} de ${doc.numPages} (OCR)…`);
      const page = await doc.getPage(p);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 2400 / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
      lines.push(...(await ocrCanvas(worker, canvas, p)));
    }
  } finally {
    await worker.terminate();
  }
  return lines;
}

/**
 * Lê PDF (texto do arquivo; se for escaneado, OCR) ou imagem (foto/print) — tudo no navegador,
 * nada é enviado a servidor.
 */
export async function extractLines(file: File, onProgress: Progress = () => undefined): Promise<ExtractResult> {
  if (file.size > MAX_BYTES) throw new Error('O arquivo é grande demais (máximo 15 MB).');
  if (isImage(file)) {
    const lines = await ocrImageFile(file, onProgress);
    if (!lines.length) throw new Error('Não foi possível reconhecer texto nesta imagem. Use uma foto nítida, reta e bem iluminada.');
    return { lines, ocr: true };
  }
  onProgress('Lendo o PDF…');
  const doc = await loadPdf(file);
  const text = await readTextLayer(doc);
  const chars = text.reduce((n, l) => n + l.cells.reduce((m, c) => m + c.text.length, 0), 0);
  if (chars >= 80) return { lines: text, ocr: false };
  const lines = await ocrPdf(doc, onProgress);
  if (!lines.length) throw new Error('Não foi possível reconhecer texto neste arquivo.');
  return { lines, ocr: true };
}
