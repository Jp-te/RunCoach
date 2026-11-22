import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../services/db';

/** Executa uma função assíncrona ao montar / quando as dependências mudam. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const run = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async () => {
    const id = ++run.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      if (id === run.current) setData(result);
    } catch (e) {
      if (id === run.current) setError(errorMessage(e));
    } finally {
      if (id === run.current) setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void reload(), deps);

  return { data, loading, error, reload, setData };
}
