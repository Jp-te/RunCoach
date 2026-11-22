import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { deleteAthlete, listAthletes, listCategories, listModalities, listNotes, saveAthlete, type AthleteInput } from '../../services/athletes';
import { errorMessage } from '../../services/db';
import { EXPERIENCE, experienceLabel } from '../../utils/constants';
import { ageFrom, todayISO } from '../../utils/format';
import type { Athlete, Category, Modality } from '../../types';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Field } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Badge, DemoBadge, EmptyState, ErrorBox, PageHeader, Spinner } from '../../components/ui/Misc';

const schema = z.object({
  full_name: z.string().trim().min(3, 'Informe o nome completo.'),
  email: z.string().trim().email('E-mail inválido.'),
  phone: z.string().trim().max(30, 'Telefone muito longo.').optional(),
});

export default function Athletes() {
  const { session } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(async () => {
    const [athletes, categories, modalities, notes] = await Promise.all([listAthletes(), listCategories(), listModalities(), listNotes()]);
    return { athletes, categories, modalities, notes };
  }, []);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [cat, setCat] = useState('');
  const [editing, setEditing] = useState<Athlete | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Athlete | null>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data?.athletes ?? []).filter(
      (a) => (!t || a.full_name.toLowerCase().includes(t) || a.email.includes(t)) && (!status || a.status === status) && (!cat || a.category_id === cat)
    );
  }, [data, q, status, cat]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;

  const catName = (id: string | null) => data.categories.find((c) => c.id === id)?.name;

  return (
    <div>
      <PageHeader
        title="Atletas"
        subtitle={`${data.athletes.length} cadastrados`}
        actions={<Button onClick={() => setEditing('new')}><UserPlus size={16} /> Novo atleta</Button>}
      />

      <div className="card mb-4 flex flex-wrap gap-3 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" aria-hidden />
          <input className="input pl-9" placeholder="Buscar por nome ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar atletas" />
        </div>
        <select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Situação">
          <option value="">Todos</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option>
        </select>
        <select className="input w-48" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            title={data.athletes.length === 0 ? 'Nenhum atleta cadastrado' : 'Nenhum atleta encontrado'}
            text={data.athletes.length === 0 ? 'Cadastre o primeiro atleta. Ele criará a senha em "Primeiro acesso" usando o e-mail informado.' : 'Ajuste os filtros da busca.'}
            action={data.athletes.length === 0 ? <Button onClick={() => setEditing('new')}><Plus size={16} /> Cadastrar atleta</Button> : undefined}
          />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => (
            <div key={a.id} className="card flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to={`/professor/atletas/${a.id}`} className="block truncate text-base font-bold hover:underline">{a.full_name}</Link>
                  <p className="truncate text-sm text-gray-500">{a.email}</p>
                </div>
                <Badge tone={a.status === 'ativo' ? 'green' : 'gray'}>{a.status === 'ativo' ? 'Ativo' : 'Inativo'}</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {a.is_demo && <DemoBadge />}
                {catName(a.category_id) && <Badge tone="blue">{catName(a.category_id)}</Badge>}
                {a.experience_level && <Badge tone="gray">{experienceLabel(a.experience_level)}</Badge>}
                {ageFrom(a.birth_date) != null && <Badge tone="gray">{ageFrom(a.birth_date)} anos</Badge>}
                <Badge tone={a.user_id ? 'green' : 'yellow'}>{a.user_id ? 'Conta ativa' : 'Aguardando 1º acesso'}</Badge>
              </div>
              {a.modalities.length > 0 && <p className="truncate text-sm text-gray-500">{a.modalities.join(' • ')}</p>}
              <div className="mt-auto flex gap-2 pt-2">
                <Link to={`/professor/atletas/${a.id}`} className="btn btn-secondary btn-sm flex-1">Abrir</Link>
                <Button size="sm" variant="ghost" aria-label={`Editar ${a.full_name}`} onClick={() => setEditing(a)}><Pencil size={15} /></Button>
                <Button size="sm" variant="ghost" aria-label={`Excluir ${a.full_name}`} onClick={() => setDeleting(a)}><Trash2 size={15} className="text-red-600" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={editing !== null} title={editing && editing !== 'new' ? 'Editar atleta' : 'Novo atleta'} onClose={() => setEditing(null)} wide>
        {editing !== null && (
          <AthleteForm
            key={editing === 'new' ? 'new' : editing.id}
            athlete={editing === 'new' ? null : editing}
            initialNotes={editing === 'new' ? '' : data.notes[editing.id] ?? ''}
            categories={data.categories}
            modalities={data.modalities}
            onCancel={() => setEditing(null)}
            onSave={async (input, notes) => {
              try {
                await saveAthlete(session!.user.id, input, notes, editing !== 'new' ? editing.id : undefined);
                toast.success('Atleta salvo.');
                setEditing(null);
                await reload();
              } catch (e) {
                toast.error(errorMessage(e));
              }
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir atleta"
        message={`Excluir "${deleting?.full_name}" apaga também treinos, registros, resultados e mensagens dele. Esta ação não pode ser desfeita. Para apenas pausar o atleta, use a situação "Inativo".`}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await deleteAthlete(deleting!.id);
            toast.success('Atleta excluído.');
            setDeleting(null);
            await reload();
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </div>
  );
}

function AthleteForm({
  athlete, initialNotes, categories, modalities, onSave, onCancel,
}: { athlete: Athlete | null; initialNotes: string; categories: Category[]; modalities: Modality[]; onSave: (i: AthleteInput, notes: string) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(athlete?.full_name ?? '');
  const [email, setEmail] = useState(athlete?.email ?? '');
  const [birth, setBirth] = useState(athlete?.birth_date ?? '');
  const [phone, setPhone] = useState(athlete?.phone ?? '');
  const [start, setStart] = useState(athlete?.start_date ?? todayISO());
  const [mods, setMods] = useState<string[]>(athlete?.modalities ?? []);
  const [categoryId, setCategoryId] = useState(athlete?.category_id ?? '');
  const [goals, setGoals] = useState(athlete?.goals ?? '');
  const [level, setLevel] = useState(athlete?.experience_level ?? '');
  const [notes, setNotes] = useState(initialNotes);
  const [status, setStatus] = useState<'ativo' | 'inativo'>(athlete?.status ?? 'ativo');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const emailLocked = Boolean(athlete?.user_id);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ full_name: name, email, phone });
    const errs: Record<string, string> = {};
    if (!parsed.success) parsed.error.issues.forEach((i) => (errs[String(i.path[0])] ??= i.message));
    if (birth && birth > todayISO()) errs.birth = 'Data de nascimento no futuro.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    await onSave({
      full_name: name.trim(), email: email.trim().toLowerCase(), birth_date: birth || null, phone: phone.trim() || null,
      start_date: start || null, modalities: mods, category_id: categoryId || null, goals: goals.trim() || null,
      experience_level: (level || null) as AthleteInput['experience_level'], status,
    }, notes);
    setBusy(false);
  }

  const toggleMod = (n: string) => setMods((l) => (l.includes(n) ? l.filter((x) => x !== n) : [...l, n]));

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome completo" error={errors.full_name} className="sm:col-span-2"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="E-mail" error={errors.email} hint={emailLocked ? 'Atleta já ativou a conta: e-mail não pode ser alterado.' : 'O atleta usará este e-mail em "Primeiro acesso".'}>
          <input className="input" type="email" value={email} disabled={emailLocked} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Telefone (opcional)" error={errors.phone}><input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="Data de nascimento" error={errors.birth}><input className="input" type="date" value={birth} onChange={(e) => setBirth(e.target.value)} /></Field>
        <Field label="Início na assessoria"><input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="Categoria">
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— sem categoria —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Nível de experiência">
          <select className="input" value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
            <option value="">— não informado —</option>
            {EXPERIENCE.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="label">Modalidades praticadas</legend>
          <div className="flex flex-wrap gap-2">
            {modalities.map((m) => (
              <label key={m.id} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${mods.includes(m.name) ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'border-gray-300 dark:border-gray-700'}`}>
                <input type="checkbox" className="sr-only" checked={mods.includes(m.name)} onChange={() => toggleMod(m.name)} />
                {m.name}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Objetivos esportivos" className="sm:col-span-2"><textarea className="input" rows={2} value={goals} onChange={(e) => setGoals(e.target.value)} /></Field>
        <Field label="Observações do professor" className="sm:col-span-2" hint="Visível apenas para você."><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <Field label="Situação">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as 'ativo' | 'inativo')}>
            <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
          </select>
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={busy}>Salvar atleta</Button>
      </div>
    </form>
  );
}
