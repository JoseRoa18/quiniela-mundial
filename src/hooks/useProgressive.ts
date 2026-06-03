import { useEffect, useRef, useState } from 'react';

/**
 * Carga progresiva ("infinite scroll" sin paginación): muestra `page` elementos
 * y va revelando más cuando el usuario se acerca al final de la lista.
 *
 *  const { visible, sentinelRef, hasMore } = useProgressive(items.length, 5, resetKey);
 *  items.slice(0, visible).map(...)
 *  {hasMore && <div ref={sentinelRef}>cargando…</div>}
 */
export function useProgressive(total: number, page = 5, resetKey?: unknown) {
  const [visible, setVisible] = useState(page);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reiniciar al cambiar la lista (p. ej. al cambiar de jornada)
  useEffect(() => setVisible(page), [resetKey, page]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible((v) => Math.min(v + page, total));
        }
      },
      { rootMargin: '300px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [total, visible, page]);

  return { visible, sentinelRef, hasMore: visible < total };
}
