import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { errorMessage } from '../services/db';
import { Button } from './ui/Button';
import { Field } from './ui/Field';
import { Section } from './ui/Misc';

export default function PasswordCard() {
  const { updatePassword } = useAuth();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setError('A senha deve ter pelo menos 8 caracteres.');
    if (pw !== confirm) return setError('As senhas não conferem.');
    setError('');
    setBusy(true);
    try {
      await updatePassword(pw);
      toast.success('Senha alterada.');
      setPw('');
      setConfirm('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Alterar senha">
      <form onSubmit={submit} className="grid max-w-md gap-3" noValidate>
        <Field label="Nova senha"><input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Field label="Confirmar nova senha" error={error}><input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        <div><Button type="submit" loading={busy}>Salvar senha</Button></div>
      </form>
    </Section>
  );
}
