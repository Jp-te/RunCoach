import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro na interface:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-bold">Algo deu errado</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">Ocorreu um erro inesperado nesta tela. Recarregue a página para continuar.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Recarregar
        </button>
      </div>
    );
  }
}
