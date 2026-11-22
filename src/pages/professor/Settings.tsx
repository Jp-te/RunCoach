import { useState, type FormEvent } from 'react';
import { Trash2, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { supabase } from '../../integrations/supabase/client';
import {
  addCategory, addGroup, addModality, deleteCategory, deleteDemoAthletes, deleteGroup, deleteModality, listAthletes,
  listCategories, listGroupMembers, listGroups, listModalities, setGroupMembers,
} from '../../services/athletes';
import { errorMessage, unwrap } from '../../services/db';
import { MODALITY_KINDS } from '../../utils/constants';
import { distanceToMeters, formatDistance } from '../../utils/format';
import { InstallInstructions } from '../Install';
import PasswordCard from '../../components/PasswordCard';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Field } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Badge, ErrorBox, PageHeader, Section, Spinner } from '../../components/ui/Misc';
import type { AthleteGroup } from '../../types';

export default function Settings() {
  const { profile, session, refreshProfile } = useAuth();
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const professorId = session!.user.id;
  const { data, loading, error, reload } = useAsync(async () => {
    const [categories, modalities, groups, members, athletes] = await Promise.all([
      listCategories(), listModalities(), listGroups(), listGroupMembers(), listAthletes(),
    ]);
    return { categories, modalities, groups, members, athletes };
  }, []);

  const [name, setName] = useState(profile?.full_name ?? '');
  const [cat, setCat] = useState('');
  const [grp, setGrp] = useState('');
  const [mName, setMName] = useState('');
  const [mDist, setMDist] = useState('');
  const [mKind, setMKind] = useState('outra');
  const [editGroup, setEditGroup] = useState<AthleteGroup | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [removeDemo, setRemoveDemo] = useState(false);

  async function run(fn: () => Promise<void>, ok: string) {
    try {
      await fn();
      toast.success(ok);
      await reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 3) return toast.error('Informe seu nome.');
    try {
      unwrap(await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', professorId));
      await refreshProfile();
      toast.success('Nome atualizado.');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;
  const demoCount = data.athletes.filter((a) => a.is_demo).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Configurações" />

      <Section title="Meu perfil e aparência">
        <form onSubmit={saveName} className="flex max-w-xl flex-wrap items-end gap-3">
          <Field label="Nome" className="min-w-[220px] flex-1"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Button type="submit">Salvar</Button>
        </form>
        <p className="mt-2 text-sm text-gray-500">E-mail: {profile?.email}</p>
        <div className="mt-3"><Button variant="secondary" onClick={toggle}>Tema: {theme === 'dark' ? 'escuro' : 'claro'} (alternar)</Button></div>
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Categorias de atletas">
          <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (cat.trim()) void run(async () => { await addCategory(professorId, cat); setCat(''); }, 'Categoria criada.'); }}>
            <input className="input" value={cat} onChange={(e) => setCat(e.target.value)} placeholder="Ex.: Iniciantes, TAF Feminino, Master" aria-label="Nova categoria" />
            <Button type="submit">Adicionar</Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {data.categories.length === 0 && <p className="text-sm text-gray-500">Nenhuma categoria.</p>}
            {data.categories.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-1 pl-3 pr-1 text-sm dark:bg-gray-800">
                {c.name}
                <button aria-label={`Remover ${c.name}`} className="rounded-full p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30" onClick={() => void run(() => deleteCategory(c.id), 'Categoria removida.')}><Trash2 size={13} /></button>
              </span>
            ))}
          </div>
        </Section>

        <Section title="Grupos de atletas">
          <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (grp.trim()) void run(async () => { await addGroup(professorId, grp); setGrp(''); }, 'Grupo criado.'); }}>
            <input className="input" value={grp} onChange={(e) => setGrp(e.target.value)} placeholder="Ex.: Turma das 6h" aria-label="Novo grupo" />
            <Button type="submit">Adicionar</Button>
          </form>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.groups.length === 0 && <p className="text-sm text-gray-500">Nenhum grupo. Grupos permitem atribuir planilhas a vários atletas de uma vez.</p>}
            {data.groups.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2 py-2">
                <span className="font-medium">{g.name} <Badge tone="gray">{data.members.filter((m) => m.group_id === g.id).length}</Badge></span>
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => { setEditGroup(g); setMembers(data.members.filter((m) => m.group_id === g.id).map((m) => m.athlete_id)); }}><Users size={14} /> Membros</Button>
                  <Button size="sm" variant="ghost" aria-label={`Excluir ${g.name}`} onClick={() => void run(() => deleteGroup(g.id), 'Grupo excluído.')}><Trash2 size={15} className="text-red-600" /></Button>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section title="Modalidades e provas">
        <p className="mb-3 text-sm text-gray-500">Cadastre outras provas além das distâncias padrão do atletismo.</p>
        <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_140px_200px_auto]" onSubmit={(e) => {
          e.preventDefault();
          if (mName.trim().length < 2) return toast.error('Informe o nome da prova.');
          const dist = mDist.trim() ? distanceToMeters(mDist, 'm') : null;
          if (mDist.trim() && dist == null) return toast.error('Distância inválida (em metros).');
          void run(async () => { await addModality(professorId, mName, dist, mKind); setMName(''); setMDist(''); }, 'Modalidade criada.');
        }}>
          <input className="input" value={mName} onChange={(e) => setMName(e.target.value)} placeholder="Nome (ex.: 15 km, Meia maratona)" aria-label="Nome da prova" />
          <input className="input" inputMode="numeric" value={mDist} onChange={(e) => setMDist(e.target.value)} placeholder="Metros" aria-label="Distância em metros" />
          <select className="input" value={mKind} onChange={(e) => setMKind(e.target.value)} aria-label="Categoria da prova">{MODALITY_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
          <Button type="submit">Adicionar</Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {data.modalities.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-1 pl-3 pr-1 text-sm dark:bg-gray-800">
              {m.name}{m.distance_m ? <span className="text-xs text-gray-500">({formatDistance(m.distance_m)})</span> : null}
              <button aria-label={`Remover ${m.name}`} className="rounded-full p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30" onClick={() => void run(() => deleteModality(m.id), 'Modalidade removida.')}><Trash2 size={13} /></button>
            </span>
          ))}
        </div>
      </Section>

      <PasswordCard />

      <Section title="Instalar como aplicativo"><InstallInstructions /></Section>

      {demoCount > 0 && (
        <Section title="Dados de exemplo">
          <p className="text-sm text-gray-600 dark:text-gray-300">Há {demoCount} atleta(s) de demonstração (marcados como EXEMPLO). Remova-os quando começar a usar dados reais; treinos e registros ligados a eles são apagados junto.</p>
          <Button className="mt-3" variant="danger" onClick={() => setRemoveDemo(true)}>Remover dados de exemplo</Button>
        </Section>
      )}

      <Modal open={editGroup !== null} title={`Membros — ${editGroup?.name ?? ''}`} onClose={() => setEditGroup(null)}>
        <div className="space-y-4">
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-gray-200 p-2 dark:border-gray-800">
            {data.athletes.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                <input type="checkbox" checked={members.includes(a.id)} onChange={() => setMembers((l) => (l.includes(a.id) ? l.filter((x) => x !== a.id) : [...l, a.id]))} />
                {a.full_name}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditGroup(null)}>Cancelar</Button>
            <Button onClick={() => void run(async () => { await setGroupMembers(professorId, editGroup!.id, members); setEditGroup(null); }, 'Grupo atualizado.')}>Salvar</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={removeDemo} title="Remover dados de exemplo" confirmLabel="Remover" message="Os atletas de exemplo e todos os dados ligados a eles serão apagados. Seus atletas reais não são afetados."
        onClose={() => setRemoveDemo(false)}
        onConfirm={async () => { await run(deleteDemoAthletes, 'Dados de exemplo removidos.'); setRemoveDemo(false); }} />
    </div>
  );
}
