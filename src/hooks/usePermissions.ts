'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Hook cliente (Fase 5 del plan RBAC) que consume los permisos efectivos de la sesión
 * actual vía `/api/admin/my-permissions` — usado por `AdminSidebar`/`AdminBottomNav` para
 * ocultar por completo los módulos sin acceso, y por páginas que necesiten condicionar
 * secciones enteras según el rol (ej. el dashboard).
 *
 * Cachea en memoria por sesión de navegador (mismo patrón que `getPermissionsForRole` en
 * el servidor): se recarga solo al cambiar de usuario, no en cada render/navegación.
 */

let cachedPermissions: Set<string> | null = null;
let cachedForUserId: string | null = null;
let inFlight: Promise<Set<string>> | null = null;

async function fetchPermissions(): Promise<Set<string>> {
  const res = await fetch('/api/admin/my-permissions');
  if (!res.ok) return new Set();
  const data = await res.json();
  return new Set(data.permissions as string[]);
}

// Interruptor maestro de pagos (decisión 10 del plan tareas/comentarios/pagos) — tiene
// precedencia sobre la matriz de permisos: si está apagado, el ítem se oculta del sidebar
// aunque el usuario tenga `pagos:read`. Cacheado igual que los permisos, invalidado solo
// al cambiar de usuario (no hay versión — es un flag de baja frecuencia de cambio).
let cachedPaymentModuleEnabled: boolean | null = null;
let paymentModuleInFlight: Promise<boolean> | null = null;

async function fetchPaymentModuleEnabled(): Promise<boolean> {
  const res = await fetch('/api/admin/payment-settings');
  if (!res.ok) return false;
  const data = await res.json();
  return Boolean(data.enabled);
}

export function usePermissions() {
  const { data: session, status } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const [permissions, setPermissions] = useState<Set<string> | null>(
    cachedForUserId === userId ? cachedPermissions : null
  );
  const [paymentModuleEnabled, setPaymentModuleEnabled] = useState<boolean | null>(cachedPaymentModuleEnabled);

  useEffect(() => {
    if (status !== 'authenticated' || !userId) return;
    // Ya resuelto por el inicializador de useState (mismo userId, caché tibia) — nada que
    // sincronizar con el efecto en este render.
    if (cachedForUserId === userId && cachedPermissions) return;

    let cancelled = false;
    if (!inFlight) {
      inFlight = fetchPermissions();
    }
    inFlight.then((granted) => {
      if (cancelled) return;
      cachedPermissions = granted;
      cachedForUserId = userId;
      inFlight = null;
      setPermissions(granted);
    });

    return () => { cancelled = true; };
  }, [status, userId]);

  useEffect(() => {
    if (status !== 'authenticated' || !userId) return;
    if (cachedPaymentModuleEnabled !== null) return;
    if (!permissions) return;
    // Solo tiene sentido consultarlo si el usuario podría llegar a ver `pagos` — evita un
    // 403 ruidoso en la consola para roles sin ningún permiso relacionado. Incluye a Admin
    // (bypass total) porque el interruptor maestro aplica también para él (decisión 10).
    const isAdmin = permissions.has('*:*');
    if (!isAdmin && !permissions.has('pagos:read')) return;

    let cancelled = false;
    if (!paymentModuleInFlight) {
      paymentModuleInFlight = fetchPaymentModuleEnabled();
    }
    paymentModuleInFlight.then((enabled) => {
      if (cancelled) return;
      cachedPaymentModuleEnabled = enabled;
      paymentModuleInFlight = null;
      setPaymentModuleEnabled(enabled);
    });

    return () => { cancelled = true; };
  }, [status, userId, permissions]);

  const isAdmin = permissions?.has('*:*') ?? false;

  function canRead(module: string): boolean {
    if (module === 'pagos' && !paymentModuleEnabled) return false;
    if (isAdmin) return true;
    return permissions?.has(`${module}:read`) ?? false;
  }

  function canWrite(module: string): boolean {
    if (module === 'pagos' && !paymentModuleEnabled) return false;
    if (isAdmin) return true;
    return permissions?.has(`${module}:write`) ?? false;
  }

  return {
    /** `null` mientras carga — usar para no ocultar el menú de golpe antes de tener datos. */
    loading: permissions === null && status !== 'unauthenticated',
    isAdmin,
    canRead,
    canWrite,
  };
}
