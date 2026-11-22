import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
interface ThemeState {
  theme: Theme;
  toggle: () => void;
}
const ThemeContext = createContext<ThemeState | null>(null);

function initial(): Theme {
  try {
    const saved = localStorage.getItem('runcoach-theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    /* armazenamento indisponível */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('runcoach-theme', theme);
    } catch {
      /* ignora */
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme fora do ThemeProvider');
  return ctx;
}
