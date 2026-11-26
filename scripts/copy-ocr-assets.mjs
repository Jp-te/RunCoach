// Copia os arquivos do OCR (motor, worker e idioma português) para public/ocr, para o app
// servi-los do próprio domínio (sem depender de CDN). Roda sozinho antes do build/dev.
import { cpSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const out = join(root, 'public', 'ocr');
mkdirSync(join(out, 'core'), { recursive: true });
mkdirSync(join(out, 'lang'), { recursive: true });

cpSync(join(nm, 'tesseract.js', 'dist', 'worker.min.js'), join(out, 'worker.min.js'));
const coreDir = join(nm, 'tesseract.js-core');
for (const f of readdirSync(coreDir)) if (/-lstm\.wasm\.js$/.test(f) || f === 'tesseract-core-lstm.wasm.js') cpSync(join(coreDir, f), join(out, 'core', f));
const lang = join(nm, '@tesseract.js-data', 'por', '4.0.0_best_int', 'por.traineddata.gz');
if (!existsSync(lang)) throw new Error('Idioma do OCR não encontrado: rode npm install.');
cpSync(lang, join(out, 'lang', 'por.traineddata.gz'));
console.log('OCR: arquivos copiados para public/ocr');
