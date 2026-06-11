import { AlertTriangle, RotateCw } from 'lucide-react';

/** Estado de error de carga con botón para reintentar. */
export default function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <AlertTriangle className="h-10 w-10 text-white/30" />
      <p className="text-sm text-white/60">{message ?? 'No se pudo cargar. Revisa tu conexión.'}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-ink"
        >
          <RotateCw className="h-4 w-4" /> Reintentar
        </button>
      )}
    </div>
  );
}
