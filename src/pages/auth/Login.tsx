import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../../contexts/AuthContext';
import { Logo } from '../../layouts/AppShell';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { errorMessage } from '../../services/db';

const loginSchema = z.object({
  email: z.string().trim().email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
});
const signupSchema = loginSchema.extend({
  name: z.string().trim().min(3, 'Informe seu nome completo.'),
});

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-gray-100 p-4 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-extrabold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        <p className="mt-4 text-center text-sm">
          <Link to="/instalar" className="font-medium text-brand-600 hover:underline">
            Instalar o RunCoach no celular
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'entrar' | 'primeiro'>('entrar');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    setInfo('');
    const parsed = (mode === 'entrar' ? loginSchema : signupSchema).safeParse({ name, email, password });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[String(i.path[0])] ??= i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (mode === 'entrar') await signIn(email, password);
      else {
        const { needsConfirmation } = await signUp(email, password, name);
        if (needsConfirmation) setInfo('Conta criada! Enviamos um link de confirmação para o seu e-mail. Confirme e depois entre.');
      }
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title={mode === 'entrar' ? 'Entrar' : 'Primeiro acesso'}
      subtitle={
        mode === 'entrar'
          ? 'Acesse sua conta de professor ou atleta.'
          : 'Use o mesmo e-mail que o seu professor cadastrou para você.'
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {mode === 'primeiro' && (
          <Field label="Nome completo" error={errors.name}>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
        )}
        <Field label="E-mail" error={errors.email}>
          <input className="input" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        <Field label="Senha" error={errors.password} hint={mode === 'primeiro' ? 'Mínimo de 8 caracteres.' : undefined}>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'}
          />
        </Field>
        {formError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {formError}
          </p>
        )}
        {info && (
          <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
            {info}
          </p>
        )}
        <Button type="submit" loading={busy} className="w-full">
          {mode === 'entrar' ? 'Entrar' : 'Criar minha conta'}
        </Button>
      </form>

      <div className="mt-4 flex flex-col gap-2 text-center text-sm">
        {mode === 'entrar' && (
          <Link to="/esqueci-senha" className="font-medium text-brand-600 hover:underline">
            Esqueci minha senha
          </Link>
        )}
        <button
          className="font-medium text-gray-600 hover:underline dark:text-gray-300"
          onClick={() => {
            setMode(mode === 'entrar' ? 'primeiro' : 'entrar');
            setErrors({});
            setFormError('');
            setInfo('');
          }}
        >
          {mode === 'entrar' ? 'Primeiro acesso? Crie sua senha' : 'Já tenho conta — entrar'}
        </button>
      </div>
    </AuthCard>
  );
}
