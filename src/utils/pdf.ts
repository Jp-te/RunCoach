import { formatDateBR, formatDistance, formatDuration, formatPace } from './format';
import type { PeriodStats, WeekPoint } from './report';

export interface ReportPdfData {
  athleteName: string;
  from: string;
  to: string;
  modalityLabel: string;
  current: PeriodStats;
  previous: PeriodStats;
  weeks: WeekPoint[];
  results: { date: string; modality: string; time_s: number; competition: string }[];
  taf: { exam: string; test: string; min: string; current: string; goal: string; status: string }[];
}

/** Gera o PDF do relatório individual (jsPDF é carregado sob demanda). */
export async function exportReportPdf(d: ReportPdfData): Promise<void> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableMod.default;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const orange: [number, number, number] = [249, 115, 22];

  doc.setFillColor(...orange);
  doc.rect(0, 0, 595, 64, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('RunCoach — Relatório do atleta', 40, 40);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Atleta: ${d.athleteName}`, 40, 92);
  doc.text(`Período: ${formatDateBR(d.from)} a ${formatDateBR(d.to)}   |   Modalidade: ${d.modalityLabel}`, 40, 110);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Gerado em ${formatDateBR(new Date().toISOString())}`, 40, 124);

  const pct = (v: number | null) => (v == null ? '—' : `${v}%`);
  autoTable(doc, {
    startY: 140,
    head: [['Indicador', 'Período atual', 'Período anterior']],
    body: [
      ['Distância total', `${d.current.km.toFixed(1)} km`, `${d.previous.km.toFixed(1)} km`],
      ['Treinos realizados', String(d.current.sessions), String(d.previous.sessions)],
      ['Treinos planejados', String(d.current.planned), String(d.previous.planned)],
      ['Conclusão das planilhas', pct(d.current.completionPct), pct(d.previous.completionPct)],
      ['Ritmo médio', formatPace(d.current.avgPaceS), formatPace(d.previous.avgPaceS)],
    ],
    headStyles: { fillColor: orange },
    styles: { fontSize: 10 },
  });

  const afterFirst = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;

  autoTable(doc, {
    startY: afterFirst(),
    head: [['Semana (início)', 'Km realizados', 'Km planejados', 'Treinos']],
    body: d.weeks.map((w) => [w.label, w.km.toFixed(1), w.plannedKm.toFixed(1), String(w.sessions)]),
    headStyles: { fillColor: orange },
    styles: { fontSize: 9 },
  });

  if (d.results.length) {
    autoTable(doc, {
      startY: afterFirst(),
      head: [['Data', 'Prova', 'Tempo', 'Competição']],
      body: d.results.map((r) => [formatDateBR(r.date), r.modality, formatDuration(r.time_s), r.competition || '—']),
      headStyles: { fillColor: orange },
      styles: { fontSize: 9 },
    });
  }
  if (d.taf.length) {
    autoTable(doc, {
      startY: afterFirst(),
      head: [['Concurso', 'Teste', 'Índice mín.', 'Atual', 'Meta', 'Situação']],
      body: d.taf.map((t) => [t.exam, t.test, t.min, t.current, t.goal, t.status]),
      headStyles: { fillColor: orange },
      styles: { fontSize: 9 },
    });
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`RunCoach • página ${i} de ${pages}`, 40, 820);
  }

  const safe = d.athleteName.normalize('NFD').replace(/[^\w]+/g, '_');
  doc.save(`relatorio_${safe}_${d.from}_${d.to}.pdf`);
}

export { formatDistance };
