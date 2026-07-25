'use client';

import { useEffect, useRef } from 'react';

export type CatalogEntityType = 'PRODUCT' | 'VARIANT' | 'SET' | 'MEDIA';
export type CatalogActivityAction = 'CREATE' | 'UPDATE';

/**
 * Hook único de tracking de productividad (Fase 7 del plan RBAC) — instrumenta el evento
 * de "inicio" al abrir un formulario de producto/variante/set/medio, y expone `finish()`
 * para el evento de "fin", que el formulario dispara explícitamente al guardar con éxito
 * (decisión 6 del plan: nunca inferido, siempre instrumentado en frontend).
 *
 * `entityId`: si ya existe (modo edición), se envía desde el inicio. Si es `undefined`
 * (modo creación), se completa en `finish(newEntityId)` con el id que devolvió el guardado.
 */
export function useActivityTracking(entityType: CatalogEntityType, entityId?: string | null) {
  const activityIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    // Un solo evento de inicio por montaje del formulario — si el usuario abre "editar"
    // y luego guarda varias veces con "Guardar y quedarse", sigue siendo la misma sesión
    // de trabajo, no una actividad nueva por cada guardado.
    if (startedRef.current) return;
    startedRef.current = true;

    const action: CatalogActivityAction = entityId ? 'UPDATE' : 'CREATE';
    fetch('/api/admin/activity/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType, action, entityId: entityId ?? null }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.activityId) activityIdRef.current = data.activityId;
      })
      .catch(() => {
        // Silencioso a propósito: el tracking de productividad nunca debe bloquear ni
        // avisar al usuario si falla — no es una operación crítica de negocio.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish(finalEntityId?: string | null) {
    const activityId = activityIdRef.current;
    if (!activityId) return;
    // Se limpia de inmediato: si el usuario vuelve a guardar ("Guardar y quedarse"),
    // no debe reintentar cerrar la misma actividad dos veces.
    activityIdRef.current = null;

    fetch(`/api/admin/activity/${activityId}/finish`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityId: finalEntityId ?? null }),
    }).catch(() => {});
  }

  return { finish };
}
