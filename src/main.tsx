import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerServiceWorker } from './hooks/usePWA';
import './styles/index.css';

registerServiceWorker();

// HashRouter: as rotas ficam depois de "#", então atualizar a página nunca gera 404 no GitHub Pages.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <HashRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </HashRouter>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);
