import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { Activity, LogOut, Menu, Moon, RefreshCw, Sun, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePWA } from '../hooks/usePWA';
import { unreadCount } from '../services/communication';

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
  badge?: 'messages';
}

export function Logo({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-xl bg-brand-500 p-1.5 text-white" aria-hidden>
        <Activity size={20} />
      </span>
      <span className={clsx('text-xl font-extrabold tracking-tight', light ? 'text-white' : '')}>
        Run<span className="text-brand-500">Coach</span>
      </span>
    </div>
  );
}

export function AppShell({ items, roleLabel, mobileTabs }: { items: NavItem[]; roleLabel: string; mobileTabs?: string[] }) {
  const { profile, signOut, session } = useAuth();
  const { theme, toggle } = useTheme();
  const { updateAvailable, applyUpdate } = usePWA();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    let alive = true;
    const load = () => unreadCount(uid).then((n) => alive && setUnread(n));
    load();
    const id = setInterval(load, 60000);
    window.addEventListener('focus', load);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener('focus', load);
    };
  }, [session?.user.id, location.pathname]);

  const renderLink = (it: NavItem, compact = false) => (
    <NavLink
      key={it.to}
      to={it.to}
      end={it.end}
      className={({ isActive }) =>
        clsx(
          compact
            ? 'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold'
            : 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
          isActive
            ? compact
              ? 'text-brand-600 dark:text-brand-400'
              : 'bg-brand-500 text-white shadow'
            : compact
              ? 'text-gray-500 dark:text-gray-400'
              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
        )
      }
    >
      <span className="relative">
        {it.icon}
        {it.badge === 'messages' && unread > 0 && (
          <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white" aria-label={`${unread} mensagens não lidas`}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </span>
      {it.label}
    </NavLink>
  );

  const sidebar = (
    <div className="flex h-full flex-col gap-1 p-4">
      <div className="mb-4 px-1">
        <Logo />
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">{roleLabel}</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Menu principal">
        {items.map((i) => renderLink(i))}
      </nav>
      <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-800">
        <p className="truncate px-1 text-sm font-semibold">{profile?.full_name}</p>
        <p className="truncate px-1 text-xs text-gray-500">{profile?.email}</p>
        <div className="mt-2 flex gap-2">
          <button onClick={toggle} className="btn btn-secondary btn-sm flex-1" aria-label="Alternar tema claro/escuro">
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            {theme === 'dark' ? 'Claro' : 'Escuro'}
          </button>
          <button onClick={() => void signOut()} className="btn btn-secondary btn-sm flex-1">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </div>
    </div>
  );

  const tabs = mobileTabs ? items.filter((i) => mobileTabs.includes(i.to)) : [];

  return (
    <div className="min-h-screen">
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:block">{sidebar}</aside>

      {/* Mobile: barra superior */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95 lg:hidden">
        <Logo />
        <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800">
          <Menu size={22} />
        </button>
      </header>

      {/* Mobile: gaveta */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white shadow-xl dark:bg-gray-900">
            <button onClick={() => setOpen(false)} aria-label="Fechar menu" className="absolute right-3 top-3 rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800">
              <X size={20} />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      {updateAvailable && (
        <div className="bg-brand-600 px-4 py-2 text-center text-sm font-medium text-white lg:pl-64">
          Nova versão do RunCoach disponível.{' '}
          <button className="inline-flex items-center gap-1 font-bold underline" onClick={applyUpdate}>
            <RefreshCw size={14} /> Atualizar agora
          </button>
        </div>
      )}

      <main className={clsx('px-4 py-5 sm:px-6 lg:pl-72 lg:pr-8 lg:py-8', tabs.length > 0 && 'pb-24 lg:pb-8')}>
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      {/* Mobile: barra inferior (atleta) */}
      {tabs.length > 0 && (
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-gray-800 dark:bg-gray-900 lg:hidden" aria-label="Navegação rápida">
          {tabs.map((t) => renderLink(t, true))}
        </nav>
      )}
    </div>
  );
}
