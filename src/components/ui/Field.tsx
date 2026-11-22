import type { ReactNode } from 'react';
import clsx from 'clsx';

interface Props {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

/** Rótulo + controle + mensagem de erro (label envolvente = associação acessível). */
export function Field({ label, error, hint, className, children }: Props) {
  return (
    <label className={clsx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </label>
  );
}
