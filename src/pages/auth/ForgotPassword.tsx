import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { errorMessage } from '../../services/db';
import { AuthCard } from './Login';

export default function ForgotPassword() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Informe um e-mail válido.');
    setError('');
    setBusy(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Recuperar senha" subtitle="Enviaremos um link para você criar uma nova senha.">
      {sent ? (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          Se o e-mail estiver cadastrado, você receberá o link em instantes. Abra-o no mesmo navegador em que fez este pedido.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="E-mail" error={error}>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Button type="submit" loading={busy} className="w-full">
            Enviar link
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </AuthCard>
  );
}
