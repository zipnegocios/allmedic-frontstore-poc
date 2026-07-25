/**
 * Seed idempotente del sistema de RBAC (Fase 1 del plan 2026-07-25-rbac-gestion-usuarios).
 * Uso: npx tsx scripts/seed-rbac.ts
 *
 * Cubre:
 * - Catálogo maestro de `permissions` (módulo:acción) según inventario de Fase 0.
 * - `role_permissions` iniciales para SALES, CATALOG_MANAGER, DISPATCHER (ADMIN = bypass total en código).
 * - Super admins protegidos (zipnegocios@gmail.com, allmedicuniforms@gmail.com).
 * - Backfill de `sales_agent_id` en quotes/corporate_accounts hacia el super admin zipnegocios.
 * - `productivity_targets` (daily_target=25) para los Gestores del Catálogo existentes.
 */
import 'dotenv/config';
import { db } from '@/db';
import {
  users,
  permissions,
  rolePermissions,
  permissionsVersion,
  productivityTargets,
  quotes,
  corporateAccounts,
} from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { hash } from 'bcryptjs';
import { uuid } from '@/lib/uuid';

// Catálogo de módulos, calcado del inventario de AdminSidebar/AdminBottomNav (Fase 0)
// más quote-config y corporate-carts (endpoints activos, sin ítem de menú).
const MODULES = [
  'dashboard',
  'productos',
  'biblioteca',
  'prospectos',
  'banners',
  'marcas',
  'tipos-producto',
  'atributos',
  'colores',
  'sucursales',
  'sets',
  'cuentas-corporativas',
  'cotizaciones',
  'reglas',
  'papelera',
  'configuracion',
  'quote-config',
  'corporate-carts',
  'usuarios',
  'permisos',
  'productividad',
] as const;

const ACTIONS = ['read', 'write'] as const;

const SALES_PERMISSIONS: Array<[string, string]> = [
  ['cotizaciones', 'read'],
  ['cotizaciones', 'write'],
  ['cuentas-corporativas', 'read'],
  ['cuentas-corporativas', 'write'],
  ['productos', 'read'],
  ['sets', 'read'],
  ['dashboard', 'read'],
];

const CATALOG_MANAGER_PERMISSIONS: Array<[string, string]> = [
  ['productos', 'read'],
  ['productos', 'write'],
  ['sets', 'read'],
  ['sets', 'write'],
  ['biblioteca', 'read'],
  ['biblioteca', 'write'],
  ['productividad', 'read'],
  ['dashboard', 'read'],
];

// DISPATCHER: sin filas — sin módulos activos aún (decisión de Fase 1).
const DISPATCHER_PERMISSIONS: Array<[string, string]> = [];

const SUPER_ADMINS = [
  { email: 'zipnegocios@gmail.com', name: 'Gustavo Amarista' },
  { email: 'allmedicuniforms@gmail.com', name: 'masteradmin' },
] as const;

async function seedPermissionsCatalog() {
  console.log('[1/5] Sembrando catálogo de permissions...');
  const existing = await db.select().from(permissions);
  const existingSet = new Set(existing.map((p) => `${p.module}:${p.action}`));

  const toInsert: Array<{ id: string; module: string; action: string }> = [];
  for (const module of MODULES) {
    for (const action of ACTIONS) {
      const key = `${module}:${action}`;
      if (!existingSet.has(key)) {
        toInsert.push({ id: uuid(), module, action });
      }
    }
  }

  if (toInsert.length > 0) {
    await db.insert(permissions).values(toInsert);
    console.log(`  → ${toInsert.length} permisos nuevos insertados.`);
  } else {
    console.log('  → catálogo ya completo, sin cambios.');
  }

  return db.select().from(permissions);
}

async function seedRolePermissions(allPermissions: Array<{ id: string; module: string; action: string }>) {
  console.log('[2/5] Sembrando role_permissions iniciales...');
  const permissionMap = new Map(allPermissions.map((p) => [`${p.module}:${p.action}`, p.id]));

  const rolesToSeed: Array<{ role: 'SALES' | 'CATALOG_MANAGER' | 'DISPATCHER'; perms: Array<[string, string]> }> = [
    { role: 'SALES', perms: SALES_PERMISSIONS },
    { role: 'CATALOG_MANAGER', perms: CATALOG_MANAGER_PERMISSIONS },
    { role: 'DISPATCHER', perms: DISPATCHER_PERMISSIONS },
  ];

  let insertedCount = 0;
  for (const { role, perms } of rolesToSeed) {
    const existing = await db.select().from(rolePermissions).where(eq(rolePermissions.role, role));
    const existingPermissionIds = new Set(existing.map((rp) => rp.permissionId));

    for (const [module, action] of perms) {
      const permissionId = permissionMap.get(`${module}:${action}`);
      if (!permissionId) {
        console.warn(`  ⚠ permiso ${module}:${action} no encontrado en catálogo, se omite.`);
        continue;
      }
      if (!existingPermissionIds.has(permissionId)) {
        await db.insert(rolePermissions).values({ id: uuid(), role, permissionId });
        insertedCount++;
      }
    }
  }
  console.log(`  → ${insertedCount} asignaciones rol-permiso nuevas.`);
}

async function ensurePermissionsVersionSingleton() {
  console.log('[3/5] Asegurando singleton permissions_version...');
  const existing = await db.select().from(permissionsVersion).limit(1);
  if (existing.length === 0) {
    await db.insert(permissionsVersion).values({ id: uuid(), version: 1 });
    console.log('  → singleton creado con version=1.');
  } else {
    console.log('  → singleton ya existe.');
  }
}

async function seedSuperAdmins() {
  console.log('[4/5] Sembrando super admins protegidos...');
  const tempPassword = 'AllMedic.RBAC.Temp2026';

  for (const { email, name } of SUPER_ADMINS) {
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (existing.length > 0) {
      if (!existing[0].isProtected) {
        await db.update(users).set({ isProtected: true }).where(eq(users.email, email));
        console.log(`  → ${email}: marcado is_protected=true (resto de datos intacto).`);
      } else {
        console.log(`  → ${email}: ya existe y ya está protegido, sin cambios.`);
      }
      continue;
    }

    const hashed = await hash(tempPassword, 12);
    const id = uuid();
    await db.insert(users).values({
      id,
      email,
      name,
      password: hashed,
      role: 'ADMIN',
      isProtected: true,
      mustChangePassword: true,
      isActive: true,
    });
    console.log(`  → ${email}: creado como ADMIN protegido (contraseña temporal, debe cambiarla en primer login).`);
  }
}

async function backfillSalesAgent() {
  console.log('[5/5] Backfill de sales_agent_id → super admin zipnegocios@gmail.com...');
  const [superAdmin] = await db.select().from(users).where(eq(users.email, 'zipnegocios@gmail.com')).limit(1);
  if (!superAdmin) {
    throw new Error('No se encontró zipnegocios@gmail.com tras seedSuperAdmins(); no se puede hacer backfill.');
  }

  const quotesResult = await db
    .update(quotes)
    .set({ salesAgentId: superAdmin.id })
    .where(isNull(quotes.salesAgentId))
    .returning({ id: quotes.id });
  console.log(`  → quotes: ${quotesResult.length} filas backfilled.`);

  const accountsResult = await db
    .update(corporateAccounts)
    .set({ salesAgentId: superAdmin.id })
    .where(isNull(corporateAccounts.salesAgentId))
    .returning({ id: corporateAccounts.id });
  console.log(`  → corporate_accounts: ${accountsResult.length} filas backfilled.`);
}

async function seedProductivityTargets() {
  console.log('[bonus] Sembrando productivity_targets para Gestores del Catálogo existentes...');
  const catalogManagers = await db.select().from(users).where(eq(users.role, 'CATALOG_MANAGER'));

  let created = 0;
  for (const manager of catalogManagers) {
    const existing = await db
      .select()
      .from(productivityTargets)
      .where(eq(productivityTargets.userId, manager.id))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(productivityTargets).values({ userId: manager.id, dailyTarget: 25 });
      created++;
    }
  }
  console.log(`  → ${created} metas de productividad nuevas (daily_target=25).`);
}

async function main() {
  const allPermissions = await seedPermissionsCatalog();
  await seedRolePermissions(allPermissions);
  await ensurePermissionsVersionSingleton();
  await seedSuperAdmins();
  await backfillSalesAgent();
  await seedProductivityTargets();
  console.log('\n✅ Seed RBAC completado.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error en seed-rbac:', err);
    process.exit(1);
  });
