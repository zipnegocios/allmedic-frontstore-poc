'use client';

import { useEffect, useRef } from 'react';
import NextTopLoader, { useTopLoader } from 'nextjs-toploader';

// Endpoints que hacen polling en segundo plano (no representan una acción del
// usuario esperando algo) — no deben disparar la barra global, o parpadearía
// cada minuto en cualquier pantalla del admin. Match por `includes`, no exacto,
// para no depender de query params.
const SILENT_FETCH_PATTERNS = ['/api/admin/notifications/unread-count'];

/**
 * Cuenta requests `fetch()` en vuelo (cualquier módulo del sitio, sin tener que
 * instrumentar cada componente) y controla la misma barra que ya usa
 * `NextTopLoader` para navegación — un solo indicador visual para ambos casos.
 * `useTopLoader` es un wrapper directo sobre el singleton global de nprogress
 * (no depende de Context/Provider), así que puede vivir como hermano de
 * `<NextTopLoader />` en vez de anidado dentro.
 */
function FetchProgressBridge() {
  const { start, done } = useTopLoader();
  // Contador de requests concurrentes — la barra solo se apaga cuando el
  // último fetch en vuelo termina, no con el primero que resuelve.
  const inFlightRef = useRef(0);

  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const url = typeof args[0] === 'string'
        ? args[0]
        : args[0] instanceof Request
          ? args[0].url
          : String(args[0]);
      const silent = SILENT_FETCH_PATTERNS.some((pattern) => url.includes(pattern));

      if (!silent) {
        if (inFlightRef.current === 0) start();
        inFlightRef.current += 1;
      }

      try {
        return await originalFetch(...args);
      } finally {
        if (!silent) {
          inFlightRef.current = Math.max(0, inFlightRef.current - 1);
          if (inFlightRef.current === 0) done();
        }
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [start, done]);

  return null;
}

/**
 * Barra de progreso global — línea negra en la parte superior del sitio,
 * visible tanto al navegar entre páginas (maneja `NextTopLoader` de forma
 * nativa) como durante cualquier `fetch()` en curso en cualquier parte del
 * sitio (`FetchProgressBridge`). Montada una sola vez en el layout raíz, cubre
 * tienda y admin por igual.
 */
export function GlobalLoadingBar() {
  return (
    <>
      <NextTopLoader
        color="#111111"
        height={3}
        showSpinner={false}
        shadow={false}
        crawl
        crawlSpeed={200}
        speed={200}
        easing="ease"
      />
      <FetchProgressBridge />
    </>
  );
}
