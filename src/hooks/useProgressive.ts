import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Carga progresiva ("infinite scroll" sin paginación): muestra `page` elementos
 * y va revelando más cuando el usuario se acerca al final de la lista.
 *
 *  const { visible, sentinelRef, hasMore } = useProgressive(items.length, 5, resetKey);
 *  items.slice(0, visible).map(...)
 *  {hasMore && <div ref={sentinelRef}>cargando…</div>}
 *
 * El observer se monta una sola vez (vía callback ref) cuando aparece el
 * centinela y lee el `total` por referencia. Antes se recreaba en cada revelado
 * (dep `visible`), lo que provocaba una carrera al reacomodarse el layout: el
 * observer nuevo podía leer "no visible" justo durante el repintado y quedarse
 * esperando un evento que nunca llegaba → spinner infinito hasta recargar.
 */
export function useProgressive(total: number, page = 5, resetKey?: unknown) {
  const [visible, setVisible] = useState(page);
  const totalRef = useRef(total);
  totalRef.current = total;
  const obsRef = useRef<IntersectionObserver | null>(null);

  // Reiniciar al cambiar la lista (p. ej. al cambiar de jornada)
  useEffect(() => setVisible(page), [resetKey, page]);

  // Callback ref: se conecta cuando el centinela se monta y se desconecta al irse.
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      obsRef.current?.disconnect();
      if (!node) return;
      const obs = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setVisible((v) => Math.min(v + page, totalRef.current));
          }
        },
        { rootMargin: '300px' },
      );
      obs.observe(node);
      obsRef.current = obs;
    },
    [page],
  );

  // Limpieza al desmontar el componente.
  useEffect(() => () => obsRef.current?.disconnect(), []);

  return { visible, sentinelRef, hasMore: visible < total };
}
