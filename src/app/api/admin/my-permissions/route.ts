import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPermissionsForRole } from '@/lib/permissions';

/**
 * Endpoint liviano usado por `usePermissions()` (Fase 5) para que el cliente sepa qué
 * módulos puede ver/editar y filtre la navegación en consecuencia. Devuelve `["*:*"]`
 * para ADMIN (bypass total, ver `getPermissionsForRole`) — el cliente lo interpreta
 * como "todo permitido" sin necesitar un caso especial.
 */
export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role) return NextResponse.json({ permissions: [] });

  const granted = await getPermissionsForRole(role);
  return NextResponse.json({ permissions: Array.from(granted) });
}
