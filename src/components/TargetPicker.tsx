import type { Athlete, AthleteGroup } from '../types';

interface Props {
  athletes: Athlete[];
  groups: AthleteGroup[];
  athleteIds: string[];
  groupIds: string[];
  onChange: (athleteIds: string[], groupIds: string[]) => void;
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/** Seleção de atletas individuais e/ou grupos (para atribuir planilhas e treinos). */
export function TargetPicker({ athletes, groups, athleteIds, groupIds, onChange }: Props) {
  const active = athletes.filter((a) => a.status === 'ativo');
  return (
    <div className="space-y-3">
      {groups.length > 0 && (
        <fieldset>
          <legend className="label">Grupos</legend>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <label key={g.id} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${groupIds.includes(g.id) ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'border-gray-300 dark:border-gray-700'}`}>
                <input type="checkbox" className="sr-only" checked={groupIds.includes(g.id)} onChange={() => onChange(athleteIds, toggle(groupIds, g.id))} />
                {g.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset>
        <legend className="label flex items-center justify-between">
          <span>Atletas ativos ({athleteIds.length} selecionados)</span>
          <button
            type="button"
            className="text-xs font-semibold text-brand-600 hover:underline"
            onClick={() => onChange(athleteIds.length === active.length ? [] : active.map((a) => a.id), groupIds)}
          >
            {athleteIds.length === active.length ? 'Limpar' : 'Selecionar todos'}
          </button>
        </legend>
        <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-gray-200 p-2 dark:border-gray-800">
          {active.length === 0 && <p className="p-2 text-sm text-gray-500">Nenhum atleta ativo cadastrado.</p>}
          {active.map((a) => (
            <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
              <input type="checkbox" checked={athleteIds.includes(a.id)} onChange={() => onChange(toggle(athleteIds, a.id), groupIds)} />
              {a.full_name}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
