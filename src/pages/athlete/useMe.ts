import { useAuth } from '../../contexts/AuthContext';

/** Registro de atleta da conta logada (garantido pelo RouteGuard + vínculo no cadastro). */
export function useMe() {
  const { athlete, profile } = useAuth();
  return { athlete, profile };
}
