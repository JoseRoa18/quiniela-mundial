import type { PredictionResult } from '../types/database';

/** Estilos por tipo de resultado de un pronóstico. */
export const RESULT_META: Record<PredictionResult, { label: string; color: string; bg: string }> = {
  pleno: { label: 'Pleno', color: '#00E5A0', bg: 'rgba(0,229,160,0.12)' },
  tendencia: { label: 'Tendencia', color: '#2D7BFF', bg: 'rgba(45,123,255,0.12)' },
  miss: { label: 'Fallo', color: '#FF5470', bg: 'rgba(255,84,112,0.12)' },
  pending: { label: 'Pendiente', color: '#9AA6B2', bg: 'rgba(255,255,255,0.05)' },
};
