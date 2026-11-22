import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ open, title, onClose, children, wide }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevActive = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prevActive?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          'card flex max-h-[92vh] w-full flex-col rounded-b-none sm:rounded-b-2xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-800">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
