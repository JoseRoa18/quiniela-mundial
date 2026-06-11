import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/** Captura errores de render para que un fallo no deje la app en blanco. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-full flex-col items-center justify-center gap-4 px-8 text-center">
          <AlertTriangle className="h-12 w-12 text-white/30" />
          <div>
            <p className="font-semibold text-white">Algo salió mal</p>
            <p className="mt-1 text-sm text-white/50">Recarga la app para continuar.</p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-ink"
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
