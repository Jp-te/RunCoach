import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import type { Athlete, Profile } from '../types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  /** Registro de atleta vinculado à conta (somente role = atleta). */
  athlete: Athlete | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** URL base do app (funciona em localhost e em https://usuario.github.io/repo/). */
export function appBaseUrl(): string {
  return window.location.origin + window.location.pathname;
}

function authMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail pelo link enviado antes de entrar.';
  if (m.includes('database error') || m.includes('não autorizado'))
    return 'Este e-mail não está autorizado. Peça ao seu professor para cadastrá-lo no RunCoach.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Este e-mail já possui conta. Use "Entrar" ou "Esqueci a senha".';
  if (m.includes('password should be') || m.includes('weak')) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com o servidor.';
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [loading, setLoading] = useState(true);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setProfile(null);
        setAthlete(null);
        setLoading(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = useCallback(async (uid: string) => {
    const { data: p } = await supabase.from('profiles').select('id,email,full_name,role').eq('id', uid).maybeSingle();
    setProfile((p as Profile) ?? null);
    if (p?.role === 'atleta') {
      const { data: a } = await supabase.from('athletes').select('*').eq('user_id', uid).maybeSingle();
      setAthlete((a as Athlete) ?? null);
    } else {
      setAthlete(null);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    load(userId).finally(() => setLoading(false));
  }, [userId, load]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      athlete,
      loading,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw new Error(authMessage(error.message));
      },
      async signUp(email, password, fullName) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { full_name: fullName.trim() }, emailRedirectTo: appBaseUrl() },
        });
        if (error) throw new Error(authMessage(error.message));
        return { needsConfirmation: !data.session };
      },
      async signOut() {
        await supabase.auth.signOut();
      },
      async sendPasswordReset(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: appBaseUrl() + '#/redefinir-senha',
        });
        if (error) throw new Error(authMessage(error.message));
      },
      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw new Error(authMessage(error.message));
      },
      async refreshProfile() {
        if (userId) await load(userId);
      },
    }),
    [session, profile, athlete, loading, userId, load]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
