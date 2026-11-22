import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ToastItem {
  id: number;
  type: 'success' | 'error';
  text: string;
}
interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
}
const ToastContext = createContext<ToastApi | null>(null);
let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (type: ToastItem['type'], text: string) => {
      const id = ++counter;
      setItems((l) => [...l, { id, type, text }]);
      setTimeout(() => remove(id), type === 'error' ? 7000 : 3500);
    },
    [remove]
  );
  const api = useMemo<ToastApi>(
    () => ({ success: (t) => push('success', t), error: (t) => push('error', t) }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
              t.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
            }`}
          >
            {t.type === 'error' ? <AlertCircle size={18} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-400" />}
            <span>{t.text}</span>
            <button onClick={() => remove(t.id)} aria-label="Fechar aviso" className="ml-2 opacity-70 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast fora do ToastProvider');
  return ctx;
}
