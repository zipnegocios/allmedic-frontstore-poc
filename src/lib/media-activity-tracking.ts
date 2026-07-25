// Registra actividad de productividad para acciones puntuales de la biblioteca de medios
// (Fase 7 del plan RBAC, decisión 5) que no tienen un ciclo de vida de formulario
// abrir→guardar — la subida o vinculación de un asset ya es, en sí misma, la acción
// completa. Por eso no usa `useActivityTracking` (pensado para ProductForm/SetForm):
// aquí el "inicio" y "fin" se registran juntos, inmediatamente después del éxito.
export async function trackMediaActivity(entityId: string | null) {
  try {
    const startRes = await fetch('/api/admin/activity/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType: 'MEDIA', action: 'CREATE', entityId }),
    });
    const { activityId } = startRes.ok ? await startRes.json() : { activityId: null };
    if (!activityId) return;
    await fetch(`/api/admin/activity/${activityId}/finish`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityId }),
    });
  } catch {
    // Silencioso a propósito: el tracking de productividad nunca debe bloquear la acción real.
  }
}
