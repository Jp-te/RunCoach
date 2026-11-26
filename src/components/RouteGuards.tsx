import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../types';
import { Spinner } from './ui/Misc';
import { Button } from './ui/Button';

export const homeFor = (role: Role) => (role === 'professor' ? '/professor' : '/atleta');

/** Exige login e papel. A proteção real está no RLS; aqui é só navegação. */
export function RequireRole({ role }: { role: Role }) {
  const { session, profile, athlete, loading, signOut } = useAuth();

  if (loading) return <Spinner />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile)
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-xl font-bold">Conta sem perfil</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Não encontramos um perfil para esta conta. Peça ao seu professor para cadastrar seu e-mail e entre novamente.
        </p>
        <Button onClick={() => void signOut()}>Sair</Button>
      </div>
    );
  if (profile.role !== role) return <Navigate to={homeFor(profile.role)} replace />;
  if (role === 'atleta' && athlete?.status === 'inativo')
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-xl font-bold">Acesso pausado</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          O seu cadastro está inativo. Fale com o seu professor para reativar o acesso aos treinos.
        </p>
        <Button onClick={() => void signOut()}>Sair</Button>
      </div>
    );
  return <Outlet />;
}

/** Telas públicas (login): se já estiver logado, vai para a área correta. */
export function PublicOnly() {
  const { session, profile, loading } = useAuth();
  if (loading) return <Spinner />;
  if (session && profile) return <Navigate to={homeFor(profile.role)} replace />;
  return <Outlet />;
}

export function HomeRedirect() {
  const { session, profile, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!session || !profile) return <Navigate to="/login" replace />;
  return <Navigate to={homeFor(profile.role)} replace />;
}
