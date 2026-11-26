import { Fragment } from 'react';
import { Dumbbell, Footprints, ListChecks, Timer } from 'lucide-react';
import type { PlanData, PlanSection } from '../types/plan';

const isSimulado = (t: string) => /simulado/i.test(t);

type Edit = (fn: (draft: PlanData) => void) => void;

/** Texto; no modo de edição vira uma caixa editável. */
function T({ value, edit, set, className = '' }: { value: string; edit?: Edit; set?: (d: PlanData, v: string) => void; className?: string }) {
  if (!edit || !set) return <>{value || '—'}</>;
  return (
    <textarea
      className={`input min-h-0 w-full resize-y py-1 text-sm ${className}`}
      rows={Math.max(1, Math.ceil(value.length / 38))}
      value={value}
      onChange={(e) => edit((d) => set(d, e.target.value))}
    />
  );
}

function Cards({ s, si, edit }: { s: Extract<PlanSection, { type: 'cards' }>; si: number; edit?: Edit }) {
  const sec = (d: PlanData) => d.sections[si] as typeof s;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {s.cards.map((c, i) => (
        <div key={i} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-600">{c.title}</h3>
          {c.lines.map((l, j) => (
            <p key={j} className="text-sm"><T value={l} edit={edit} set={(d, v) => (sec(d).cards[i].lines[j] = v)} /></p>
          ))}
        </div>
      ))}
    </div>
  );
}

function Table({ s, si, edit }: { s: Extract<PlanSection, { type: 'table' }>; si: number; edit?: Edit }) {
  const sec = (d: PlanData) => d.sections[si] as typeof s;
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <table className="w-full min-w-[520px] text-sm">
        {s.headers.some(Boolean) && (
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-950">
            <tr>{s.headers.map((h, i) => <th key={i} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
          </thead>
        )}
        <tbody>
          {s.rows.map((r, i) => (
            <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
              {r.map((c, j) => (
                <td key={j} className={j === 0 ? 'px-3 py-2 font-semibold' : 'px-3 py-2'}>
                  {edit ? <T value={c} edit={edit} set={(d, v) => (sec(d).rows[i][j] = v)} /> : c || <span className="text-gray-300 dark:text-gray-700">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Weeks({ s, si, edit }: { s: Extract<PlanSection, { type: 'weeks' }>; si: number; edit?: Edit }) {
  const sec = (d: PlanData) => d.sections[si] as typeof s;
  return (
    <div className="space-y-3">
      {s.rows.map((r, ri) => (
        <div key={ri} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
          <div className="mb-2 flex items-center gap-2">
            <span className="grid h-7 min-w-7 place-items-center rounded-full bg-brand-500 px-2 text-xs font-bold text-white">{r.week}</span>
            <span className="text-sm font-semibold">Semana {parseInt(r.week, 10) || r.week}</span>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {s.columns.map((col, i) => (
              <div key={i} className={isSimulado(r.cells[i] ?? '') ? 'rounded-lg border border-brand-300 bg-brand-50 p-2 dark:border-brand-700 dark:bg-brand-950/30' : 'rounded-lg bg-gray-50 p-2 dark:bg-gray-950'}>
                <p className="mb-0.5 flex items-center gap-1 text-xs font-bold text-gray-500"><Footprints size={12} aria-hidden /> {col}</p>
                <p className="text-sm"><T value={r.cells[i] ?? ''} edit={edit} set={(d, v) => (sec(d).rows[ri].cells[i] = v)} /></p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Lists({ s, si, edit }: { s: Extract<PlanSection, { type: 'lists' }>; si: number; edit?: Edit }) {
  const sec = (d: PlanData) => d.sections[si] as typeof s;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {s.groups.map((g, i) => (
        <div key={i} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Dumbbell size={15} className="text-brand-600" aria-hidden /> {g.title}</h3>
          <ul className="space-y-1.5 text-sm">
            {g.items.map((it, j) => <li key={j}><T value={it} edit={edit} set={(d, v) => (sec(d).groups[i].items[j] = v)} /></li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Text({ s, si, edit }: { s: Extract<PlanSection, { type: 'text' }>; si: number; edit?: Edit }) {
  const parts = s.text.split(/\s*\(\d+\)\s*/).filter(Boolean);
  const numbered = !edit && /\(\d+\)/.test(s.text) && parts.length >= 2;
  return (
    <div className="rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-950/20">
      <h3 className="mb-1 flex items-center gap-1.5 font-bold"><ListChecks size={15} aria-hidden /> {s.title}</h3>
      {numbered ? (
        <ol className="list-decimal space-y-1 pl-5">
          {parts.map((p, i) => <li key={i}>{p}</li>)}
        </ol>
      ) : (
        <p><T value={s.text} edit={edit} set={(d, v) => ((d.sections[si] as typeof s).text = v)} /></p>
      )}
    </div>
  );
}

export default function PlanView({ plan, hideTitle, onChange }: { plan: PlanData; hideTitle?: boolean; onChange?: (p: PlanData) => void }) {
  const edit: Edit | undefined = onChange
    ? (fn) => {
        const d = structuredClone(plan);
        fn(d);
        onChange(d);
      }
    : undefined;
  return (
    <div className="space-y-5">
      <div>
        {!hideTitle && <h2 className="flex items-center gap-2 text-lg font-extrabold"><Timer size={20} className="text-brand-600" aria-hidden /> {plan.title}</h2>}
        {plan.meta.length > 0 && (
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
            {plan.meta.map((m, i) => <span key={i}><b>{m.label}:</b> {m.value}</span>)}
          </p>
        )}
      </div>
      {plan.sections.map((s, i) => (
        <Fragment key={i}>
          {s.type !== 'cards' && s.type !== 'text' && <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">{s.title}</h3>}
          {s.type === 'cards' && <Cards s={s} si={i} edit={edit} />}
          {s.type === 'table' && <Table s={s} si={i} edit={edit} />}
          {s.type === 'weeks' && <Weeks s={s} si={i} edit={edit} />}
          {s.type === 'lists' && <Lists s={s} si={i} edit={edit} />}
          {s.type === 'text' && <Text s={s} si={i} edit={edit} />}
        </Fragment>
      ))}
    </div>
  );
}
