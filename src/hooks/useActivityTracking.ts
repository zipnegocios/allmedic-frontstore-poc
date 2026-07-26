'use client';

import { useEffect, useRef } from 'react';

export type CatalogEntityType = 'PRODUCT' | 'VARIANT' | 'SET' | 'MEDIA';
export type CatalogActivityAction = 'CREATE' | 'UPDATE';

/** Diff de campos modificados — solo se calcula para `action = UPDATE` (Fase 5 del plan
 * tareas/comentarios/pagos, decisión 12). `{ before, after }` por cada campo que cambió. */
export type ChangedFields = Record<string, { before: unknown; after: unknown }>;

function computeDiff(before: Record<string, unknown>, after: Record<string, unknown>): ChangedFields {
  const diff: ChangedFields = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const beforeValue = before[key];
    const afterValue = after[key];
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      diff[key] = { before: beforeValue ?? null, after: afterValue ?? null };
    }
  }
  return diff;
}

/**
 * Hook único de tracking de productividad (Fase 7 del plan RBAC, extendido en Fase 5 del
 * plan tareas/comentarios/pagos) — instrumenta el evento de "inicio" al abrir un formulario
 * de producto/variante/set/medio, y expone `finish()` para el evento de "fin", que el
 * formulario dispara explícitamente al guardar con éxito (decisión 6 del plan RBAC: nunca
 * inferido, siempre instrumentado en frontend).
 *
 * `entityId`: si ya existe (modo edición), se envía desde el inicio. Si es `undefined`
 * (modo creación), se completa en `finish(newEntityId)` con el id que devolvió el guardado.
 *
 * `initialSnapshot`: valores del formulario al montar — se compara contra el snapshot final
 * pasado a `finish()` para calcular `changedFields` (solo tiene efecto en `UPDATE`; en
 * `CREATE` no hay "antes" que comparar).
 */
export function useActivityTracking(
  entityType: CatalogEntityType,
  entityId?: string | null,
  initialSnapshot?: Record<string, unknown>
) {
  const activityIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const snapshotRef = useRef(initialSnapshot);
  snapshotRef.current = snapshotRef.current ?? initialSnapshot;

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

  function finish(finalEntityId?: string | null, finalSnapshot?: Record<string, unknown>, taskId?: string | null) {
    const activityId = activityIdRef.current;
    if (!activityId) return;
    // Se limpia de inmediato: si el usuario vuelve a guardar ("Guardar y quedarse"),
    // no debe reintentar cerrar la misma actividad dos veces.
    activityIdRef.current = null;

    const changedFields = snapshotRef.current && finalSnapshot
      ? computeDiff(snapshotRef.current, finalSnapshot)
      : undefined;

    fetch(`/api/admin/activity/${activityId}/finish`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityId: finalEntityId ?? null,
        changedFields: changedFields && Object.keys(changedFields).length > 0 ? changedFields : undefined,
        taskId: taskId ?? undefined,
      }),
    }).catch(() => {});
  }

  /** Incrementa el conteo de medios de la sesión de actividad activa — llamado cada vez
   * que se sube/vincula un medio sin cerrar el formulario (Fase 5 del plan). No-op si la
   * actividad ya se cerró (`finish` ya se llamó) o si el `start` inicial todavía no resolvió. */
  function trackMedia() {
    const activityId = activityIdRef.current;
    if (!activityId) return;
    fetch(`/api/admin/activity/${activityId}/media-count`, { method: 'PATCH' }).catch(() => {});
  }

  return { finish, trackMedia };
}
