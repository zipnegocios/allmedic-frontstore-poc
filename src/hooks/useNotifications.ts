'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

/** Badge de notificaciones sin leer (Fase 8 del plan tareas/comentarios/pagos) — polling
 * simple cada 60s mientras hay sesión activa, sin caché entre componentes (a diferencia de
 * `usePermissions()`, el conteo cambia con frecuencia y no vale la pena compartir estado). */
export function useNotifications() {
  const { status } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications/unread-count');
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
      }
    } catch {
      // Silencioso — el badge de notificaciones no es crítico, no debe interrumpir la navegación.
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    const tick = () => { if (!cancelled) refresh(); };
    tick();
    const interval = setInterval(tick, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status, refresh]);

  async function markAllRead() {
    await fetch('/api/admin/notifications/mark-read', { method: 'POST' });
    setUnreadCount(0);
  }

  return { unreadCount, refresh, markAllRead };
}
