import type { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  loading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', className)}
      {...rest}
    >
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
