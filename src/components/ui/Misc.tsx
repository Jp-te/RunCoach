import type { ReactNode } from 'react';
import clsx from 'clsx';
import { AlertTriangle, Loader2, Inbox } from 'lucide-react';
import { Button } from './Button';

export function Spinner({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-gray-500" role="status">
      <Loader2 className="animate-spin text-brand-500" size={22} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <div className="flex items-start gap-2">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <div className="rounded-full bg-brand-50 p-3 text-brand-600 dark:bg-gray-800 dark:text-brand-400">{icon ?? <Inbox size={24} />}</div>
      <p className="font-semibold">{title}</p>
      {text && <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

type Tone = 'gray' | 'orange' | 'green' | 'red' | 'blue' | 'yellow';
const tones: Record<Tone, string> = {
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  orange: 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300',
  green: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  blue: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
};
export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', tones[tone])}>{children}</span>;
}

export function StatCard({ label, value, icon, hint, tone = 'orange' }: { label: string; value: ReactNode; icon: ReactNode; hint?: string; tone?: 'orange' | 'green' | 'red' | 'blue' }) {
  const bg = {
    orange: 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    blue: 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  }[tone];
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className={clsx('rounded-xl p-3', bg)} aria-hidden>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-extrabold leading-tight">{value}</p>
        {hint && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
    </div>
  );
}

export function Section({ title, actions, children, className }: { title: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('card p-4 sm:p-5', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function DemoBadge() {
  return <Badge tone="yellow">EXEMPLO</Badge>;
}

export function ConfirmText({ children }: { children: ReactNode }) {
  return <p className="text-sm text-gray-600 dark:text-gray-300">{children}</p>;
}
