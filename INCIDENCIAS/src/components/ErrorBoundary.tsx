import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Nora Uncaught React Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReload = () => {
    window.location.reload();
  };

  public handleReset = () => {
    try {
      sessionStorage.removeItem('last_selected_issue');
    } catch (_) {}
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center select-text">
          <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-6 shadow-2xl">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black uppercase tracking-wider mb-2 text-white">
            Se detectó un problema en la vista
          </h2>
          <p className="text-xs text-slate-400 max-w-md mb-4 leading-relaxed font-medium">
            Se evitó la pantalla blanca. El sistema aisló el fallo para que puedas continuar.
          </p>

          {this.state.error && (
            <div className="max-w-xl w-full bg-black/60 border border-red-500/30 rounded-2xl p-4 mb-6 text-left overflow-auto max-h-48">
              <p className="text-[11px] font-mono text-red-400 font-bold mb-1">
                {this.state.error.name}: {this.state.error.message}
              </p>
              {this.state.error.stack && (
                <pre className="text-[9px] font-mono text-slate-400 whitespace-pre-wrap leading-tight">
                  {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                </pre>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={this.handleReset}
              className="px-6 py-3 rounded-xl bg-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider hover:bg-amber-400 transition-all shadow-lg active:scale-95"
            >
              Reintentar Vista
            </button>
            <button
              onClick={this.handleReload}
              className="px-6 py-3 rounded-xl bg-slate-800 text-white text-xs font-black uppercase tracking-wider hover:bg-slate-700 transition-all flex items-center gap-2 border border-slate-700 active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Recargar Nora
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
