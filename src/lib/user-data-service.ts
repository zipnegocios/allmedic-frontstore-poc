// ─── CRUD de Usuarios (capa de datos) — Fase 3 del plan RBAC ───
// Consumido por las API routes de `/api/admin/users/**`. Aplica las protecciones de
// super admin (decisión 15/16 del plan) y el versionado de sesión (decisión 14) que
// no dependen de la UI — deben cumplirse aunque la petición llegue directo a la API.

import { db } from '@/db';
import { users, productivityTargets } from '@/db/schema';
import { eq, asc, sql } from 'drizzle-orm';
import { hash } from 'bcryptjs';

export type UserRole = 'ADMIN' | 'SALES' | 'CATALOG_MANAGER' | 'DISPATCHER' | 'CORPORATE_CLIENT';

/** Lanzado al intentar eliminar, desactivar o cambiar el rol de un super admin protegido
 * (`is_protected = true`, decisión 15 del plan) — ni siquiera otro Admin puede hacerlo. */
export class ProtectedUserError extends Error {
  constructor() {
    super('Esta cuenta está protegida y no puede eliminarse, desactivarse ni cambiar de rol.');
    this.name = 'ProtectedUserError';
  }
}

export async function getAdminUsers() {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      scopeLevel: users.scopeLevel,
      isActive: users.isActive,
      isProtected: users.isProtected,
      mustChangePassword: users.mustChangePassword,
      isTaskCoordinator: users.isTaskCoordinator,
      createdAt: users.createdAt,
    })
    .from(users)
    // Los clientes corporativos (portal público) no son "usuarios del panel admin" —
    // esta pantalla gestiona solo los roles operativos de este plan.
    .where(sql`${users.role} != 'CORPORATE_CLIENT'`)
    .orderBy(asc(users.name));
  return rows;
}

export async function getAdminUserById(id: string) {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      scopeLevel: users.scopeLevel,
      isActive: users.isActive,
      isProtected: users.isProtected,
      mustChangePassword: users.mustChangePassword,
      isTaskCoordinator: users.isTaskCoordinator,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user ?? null;
}

function generateTemporaryPassword(): string {
  // 12 caracteres alfanuméricos — suficiente para una contraseña temporal de un solo uso
  // (el usuario está obligado a cambiarla en su primer login, ver `mustChangePassword`).
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
}

export interface CreateUserInput {
  name: string;
  email: string;
  role: UserRole;
  scopeLevel?: 'OWN' | 'ALL';
}

/** Crea un usuario con contraseña temporal autogenerada — el llamador (ruta API) es
 * responsable de comunicarla al Admin para que se la entregue al usuario nuevo. */
export async function createAdminUser(input: CreateUserInput) {
  const temporaryPassword = generateTemporaryPassword();
  const hashedPassword = await hash(temporaryPassword, 12);

  const [user] = await db
    .insert(users)
    .values({
      name: input.name,
      email: input.email,
      password: hashedPassword,
      role: input.role,
      scopeLevel: input.scopeLevel ?? 'OWN',
      mustChangePassword: true,
      isActive: true,
    })
    .returning({ id: users.id, name: users.name, email: users.email, role: users.role });

  if (input.role === 'CATALOG_MANAGER') {
    await db.insert(productivityTargets).values({ userId: user.id, dailyTarget: 25 });
  }

  return { user, temporaryPassword };
}

export interface UpdateUserInput {
  name?: string;
  role?: UserRole;
  scopeLevel?: 'OWN' | 'ALL';
  isActive?: boolean;
  isTaskCoordinator?: boolean;
}

/**
 * Actualiza un usuario, aplicando las protecciones de super admin (decisión 15) y el
 * versionado de sesión (decisión 14): cualquier cambio de `role` o `is_active` incrementa
 * `session_version`, forzando el cierre de sesión casi inmediato del usuario afectado
 * (ver `isSessionStillValid` en `@/lib/permissions`).
 */
export async function updateAdminUser(id: string, input: UpdateUserInput) {
  const [current] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!current) return null;

  const changesRole = input.role !== undefined && input.role !== current.role;
  const changesActive = input.isActive !== undefined && input.isActive !== current.isActive;

  if (current.isProtected && (changesRole || changesActive)) {
    throw new ProtectedUserError();
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.role !== undefined) patch.role = input.role;
  if (input.scopeLevel !== undefined) patch.scopeLevel = input.scopeLevel;
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  if (input.isTaskCoordinator !== undefined) patch.isTaskCoordinator = input.isTaskCoordinator;
  if (changesRole || changesActive) {
    patch.sessionVersion = sql`${users.sessionVersion} + 1`;
  }

  const [updated] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, id))
    .returning({
      id: users.id, name: users.name, email: users.email, role: users.role,
      scopeLevel: users.scopeLevel, isActive: users.isActive, isProtected: users.isProtected,
      isTaskCoordinator: users.isTaskCoordinator,
    });

  // Si el rol nuevo es CATALOG_MANAGER y todavía no tiene meta de productividad, se la asigna.
  if (changesRole && input.role === 'CATALOG_MANAGER') {
    const [existingTarget] = await db.select().from(productivityTargets).where(eq(productivityTargets.userId, id)).limit(1);
    if (!existingTarget) {
      await db.insert(productivityTargets).values({ userId: id, dailyTarget: 25 });
    }
  }

  return updated;
}

/** Elimina un usuario — bloqueado para super admins protegidos (decisión 15). */
export async function deleteAdminUser(id: string) {
  const [current] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!current) return false;
  if (current.isProtected) throw new ProtectedUserError();

  await db.delete(users).where(eq(users.id, id));
  return true;
}

/**
 * Resetea la contraseña de un usuario a una temporal autogenerada y vuelve a exigir
 * cambio en el próximo login (decisión 8 del plan). No incrementa `session_version`
 * a propósito: el reset de contraseña no invalida la sesión actual del usuario (solo
 * el cambio de rol/estado lo hace, decisión 14) — si el Admin quiere forzar el cierre
 * de sesión inmediato además del reset, debe desactivar y reactivar la cuenta.
 */
export async function resetUserPassword(id: string) {
  const temporaryPassword = generateTemporaryPassword();
  const hashedPassword = await hash(temporaryPassword, 12);

  const [updated] = await db
    .update(users)
    .set({ password: hashedPassword, mustChangePassword: true })
    .where(eq(users.id, id))
    .returning({ id: users.id, email: users.email });

  if (!updated) return null;
  return { user: updated, temporaryPassword };
}

/** Cambia la contraseña del propio usuario (pantalla obligatoria de primer login) —
 * requiere la contraseña actual para evitar que una sesión robada la cambie sin más. */
export async function changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
  const { compare } = await import('bcryptjs');
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || !user.password) return { ok: false as const, error: 'Usuario no encontrado' };

  const valid = await compare(currentPassword, user.password);
  if (!valid) return { ok: false as const, error: 'Contraseña actual incorrecta' };

  const hashedPassword = await hash(newPassword, 12);
  await db.update(users).set({ password: hashedPassword, mustChangePassword: false }).where(eq(users.id, userId));
  return { ok: true as const };
}
