import { useRef, useState } from 'react';
import { CalendarPlus, Eye, FileUp, Trash2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { deletePlan, generateWorkoutsFromPlan, listPlans, savePlan } from '../services/plans';
import { errorMessage } from '../services/db';
import type { PlanData, TrainingPlan } from '../types/plan';
import { addDays, formatDateBR, startOfWeek, todayISO } from '../utils/format';
import { extractLines } from '../utils/pdfExtract';
import { parsePlan, planToWorkouts } from '../utils/planParser';
import PlanView from './PlanView';
import { Button } from './ui/Button';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { Field } from './ui/Field';
import { Modal } from './ui/Modal';
import { Badge, EmptyState, ErrorBox, Section, Spinner } from './ui/Misc';

const nextMonday = () => addDays(startOfWeek(todayISO()), 7);

interface Draft {
  data: PlanData;
  file: string;
  ocr: boolean;
}

export default function PlanPanel({ athleteId, professorId }: { athleteId: string; professorId: string }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const { data: plans, loading, error, reload } = useAsync(() => listPlans(athleteId), [athleteId]);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [viewing, setViewing] = useState<TrainingPlan | null>(null);
  const [removing, setRemoving] = useState<TrainingPlan | null>(null);
  const [generating, setGenerating] = useState<TrainingPlan | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (input.current) input.current.value = '';
    if (!/\.(pdf|png|jpe?g|webp)$/i.test(file.name) && !/^(application\/pdf|image\/)/.test(file.type)) {
      toast.error('Escolha um PDF ou uma foto (JPG/PNG) do plano.');
      return;
    }
    setReading(true);
    setProgress('');
    try {
      const { lines, ocr } = await extractLines(file, (m, f) => setProgress(f !== undefined ? `${m} ${Math.round(f * 100)}%` : m));
      setDraft({ data: parsePlan(lines), file: file.name, ocr });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setReading(false);
      setProgress('');
    }
  }

  return (
    <Section
      title="Planos importados de PDF"
      actions={
        <>
          <input ref={input} type="file" accept="application/pdf,.pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Selecionar PDF ou foto do plano de treino" />
          <Button size="sm" onClick={() => input.current?.click()} loading={reading}>
            <FileUp size={16} aria-hidden /> Importar PDF / foto
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
        Envie uma planilha de treinamento em PDF (como a de TAF) ou uma <b>foto/print</b> dela: o RunCoach lê o arquivo no seu navegador (PDF escaneado e foto usam reconhecimento de texto, OCR), mostra o resultado para você conferir e <b>corrigir</b>, e salva o plano completo para o atleta ver no app.
      </p>
      {reading && <p className="mb-3 rounded-lg bg-brand-50 p-2 text-sm text-brand-700 dark:bg-brand-950/30" role="status">{progress || 'Lendo o arquivo…'} (a primeira leitura por OCR pode levar de 10 a 60 segundos)</p>}
      {loading && !plans ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : !plans?.length ? (
        <EmptyState title="Nenhum plano importado" text="Clique em “Importar PDF” para começar." />
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {plans.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.title}</p>
                <p className="text-xs text-gray-500">
                  Importado em {formatDateBR(p.created_at)}{p.source_file ? ` • ${p.source_file}` : ''}
                  {p.generated_at ? <> • treinos gerados em {formatDateBR(p.generated_at)} (início {formatDateBR(p.start_date)})</> : <> • treinos ainda não gerados</>}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setViewing(p)}><Eye size={15} aria-hidden /> Ver</Button>
                <Button size="sm" variant="secondary" onClick={() => setGenerating(p)}><CalendarPlus size={15} aria-hidden /> Gerar treinos</Button>
                <Button size="sm" variant="ghost" aria-label="Excluir plano" onClick={() => setRemoving(p)}><Trash2 size={15} aria-hidden /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <ImportReview
          draft={draft}
          onClose={() => setDraft(null)}
          onSave={async (data, startDate, generate) => {
            const planId = await savePlan(professorId, athleteId, data, draft.file, generate ? startDate : null);
            if (generate) {
              const n = await generateWorkoutsFromPlan(professorId, athleteId, data, startDate, planId);
              toast.success(`Plano salvo e ${n} treinos agendados no calendário do atleta.`);
            } else toast.success('Plano salvo. O atleta já pode vê-lo em “Meu plano”.');
            setDraft(null);
            reload();
          }}
        />
      )}

      <Modal open={!!viewing} title="Plano de treino" onClose={() => setViewing(null)} wide>
        {viewing && <PlanView plan={viewing.data} />}
      </Modal>

      {generating && (
        <GenerateDialog
          plan={generating}
          onClose={() => setGenerating(null)}
          onGenerate={async (start) => {
            const n = await generateWorkoutsFromPlan(professorId, athleteId, generating.data, start, generating.id);
            reload();
            toast.success(`${n} treinos agendados no calendário do atleta.`);
            setGenerating(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!removing}
        title="Excluir plano"
        message="O plano importado será removido (os treinos já agendados no calendário não são apagados)."
        onConfirm={async () => {
          try {
            await deletePlan(removing!.id);
            toast.success('Plano excluído.');
            setRemoving(null);
            reload();
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
        onClose={() => setRemoving(null)}
      />
    </Section>
  );
}

function StartDate({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const monday = startOfWeek(value);
  return (
    <Field label="Data de início do ciclo" hint={monday !== value ? `O ciclo sempre começa numa segunda-feira: será usada ${formatDateBR(monday)}.` : 'Semana 1 começa nesta segunda-feira.'}>
      <input type="date" className="input" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} />
    </Field>
  );
}

function ImportReview({ draft: initial, onClose, onSave }: { draft: Draft; onClose: () => void; onSave: (data: PlanData, startDate: string, generate: boolean) => Promise<void> }) {
  const toast = useToast();
  const [draft, setDraft] = useState(initial);
  const [start, setStart] = useState(nextMonday());
  const [generate, setGenerate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const count = planToWorkouts(draft.data).length;

  return (
    <Modal open title="Conferir plano importado" onClose={onClose} wide>
      <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
        <p className="font-semibold">Confira antes de salvar</p>
        <p>A leitura é automática e pode errar em arquivos com layout diferente. Compare com o arquivo <b>{draft.file}</b>. <b>Todos os textos abaixo são editáveis</b> — corrija o que estiver errado antes de salvar.</p>
        {draft.ocr && <p className="mt-1 font-semibold text-red-700 dark:text-red-400">⚠ Este arquivo foi lido por OCR (reconhecimento de imagem): confira principalmente tempos, ritmos e distâncias (ex.: 3'12" pode sair como 312").</p>}
        {draft.data.warnings.map((w, i) => <p key={i} className="mt-1 font-semibold text-red-700 dark:text-red-400">⚠ {w}</p>)}
      </div>
      <div className="mb-4">
        <Field label="Título do plano">
          <input className="input" maxLength={200} value={draft.data.title} onChange={(e) => setDraft((d) => ({ ...d, data: { ...d.data, title: e.target.value } }))} />
        </Field>
      </div>
      <PlanView plan={draft.data} onChange={(data) => setDraft((d) => ({ ...d, data }))} />
      <div className="mt-4">
        <button type="button" className="text-sm font-medium text-brand-600 hover:underline" onClick={() => setShowRaw((v) => !v)}>
          {showRaw ? 'Ocultar' : 'Ver'} texto bruto lido do PDF
        </button>
        {showRaw && <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-950">{draft.data.raw.join('\n')}</pre>}
      </div>
      <div className="mt-5 space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={generate} onChange={(e) => setGenerate(e.target.checked)} disabled={count === 0} />
          <span>
            <b>Também agendar os treinos no calendário do atleta</b> ({count} treinos reconhecidos: corrida e academia, cada um no dia da semana indicado). O atleta é notificado.
          </span>
        </label>
        {generate && count > 0 && <StartDate value={start} onChange={setStart} />}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(draft.data, startOfWeek(start), generate && count > 0);
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Salvar plano
        </Button>
      </div>
    </Modal>
  );
}

function GenerateDialog({ plan, onClose, onGenerate }: { plan: TrainingPlan; onClose: () => void; onGenerate: (start: string) => Promise<void> }) {
  const toast = useToast();
  const [start, setStart] = useState(nextMonday());
  const [busy, setBusy] = useState(false);
  const [again, setAgain] = useState(false);
  const count = planToWorkouts(plan.data).length;
  return (
    <Modal open title="Gerar treinos no calendário" onClose={onClose}>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
        Serão criados <Badge tone="orange">{count} treinos</Badge> a partir do plano.
      </p>
      {plan.generated_at && (
        <label className="mb-3 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-2 text-sm dark:border-red-800 dark:bg-red-950/30">
          <input type="checkbox" className="mt-1" checked={again} onChange={(e) => setAgain(e.target.checked)} />
          <span>Os treinos deste plano <b>já foram gerados em {formatDateBR(plan.generated_at)}</b>. Marque para gerar mesmo assim (vai duplicar os treinos).</span>
        </label>
      )}
      <StartDate value={start} onChange={setStart} />
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button
          loading={busy}
          disabled={count === 0 || (!!plan.generated_at && !again)}
          onClick={async () => {
            setBusy(true);
            try {
              await onGenerate(startOfWeek(start));
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Gerar treinos
        </Button>
      </div>
    </Modal>
  );
}
