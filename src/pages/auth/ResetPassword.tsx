import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Spinner } from '../../components/ui/Misc';
import { errorMessage } from '../../services/db';
import { AuthCard } from './Login';

export default function ResetPassword() {
  const { session, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError('A senha deve ter pelo menos 8 caracteres.');
    if (password !== confirm) return setError('As senhas não conferem.');
    setError('');
    setBusy(true);
    try {
      await updatePassword(password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <AuthCard title="Nova senha" subtitle="Crie uma nova senha para acessar o RunCoach.">
      {!session ? (
        <div className="space-y-3 text-sm">
          <p className="rounded-lg bg-yellow-50 p-3 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
            Link inválido ou expirado. Solicite um novo link e abra-o no mesmo navegador em que fez o pedido.
          </p>
          <Link to="/esqueci-senha" className="font-medium text-brand-600 hover:underline">
            Solicitar novo link
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Nova senha" hint="Mínimo de 8 caracteres.">
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Confirmar nova senha" error={error}>
            <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </Field>
          <Button type="submit" loading={busy} className="w-full">
            Salvar nova senha
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
