/**
 * Seed idempotente del plan de tareas/comentarios/pagos (Fase 1 del plan
 * 2026-07-25-tareas-comentarios-pagos-productividad.md).
 * Uso: npx tsx scripts/seed-tareas-pagos.ts
 *
 * Cubre:
 * - Módulos nuevos (`tareas`, `comentarios`, `pagos`) en el catálogo maestro de permissions.
 * - `role_permissions` iniciales para CATALOG_MANAGER (tareas:read, comentarios:read/write,
 *   pagos:read) según decisión de Fase 1 del plan.
 * - Incrementa `permissions_version` para que la matriz nueva aplique sin relogin.
 * - Singleton `system_settings` (payment_module_enabled=false por defecto — decisión 10).
 */
import 'dotenv/config';
import { db } from '@/db';
import { permissions, rolePermissions, permissionsVersion, systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { uuid } from '@/lib/uuid';

const NEW_MODULES = ['tareas', 'comentarios', 'pagos'] as const;
const ACTIONS = ['read', 'write'] as const;

const CATALOG_MANAGER_NEW_PERMISSIONS: Array<[string, string]> = [
  ['tareas', 'read'],
  ['comentarios', 'read'],
  ['comentarios', 'write'],
  ['pagos', 'read'],
];

async function seedNewModules() {
  console.log('[1/3] Sembrando módulos nuevos (tareas, comentarios, pagos)...');
  const existing = await db.select().from(permissions);
  const existingSet = new Set(existing.map((p) => `${p.module}:${p.action}`));

  const toInsert: Array<{ id: string; module: string; action: string }> = [];
  for (const module of NEW_MODULES) {
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

async function seedCatalogManagerPermissions(allPermissions: Array<{ id: string; module: string; action: string }>) {
  console.log('[2/3] Sembrando role_permissions de CATALOG_MANAGER para módulos nuevos...');
  const permissionMap = new Map(allPermissions.map((p) => [`${p.module}:${p.action}`, p.id]));

  const existing = await db.select().from(rolePermissions).where(eq(rolePermissions.role, 'CATALOG_MANAGER'));
  const existingPermissionIds = new Set(existing.map((rp) => rp.permissionId));

  let insertedCount = 0;
  for (const [module, action] of CATALOG_MANAGER_NEW_PERMISSIONS) {
    const permissionId = permissionMap.get(`${module}:${action}`);
    if (!permissionId) {
      console.warn(`  ⚠ permiso ${module}:${action} no encontrado en catálogo, se omite.`);
      continue;
    }
    if (!existingPermissionIds.has(permissionId)) {
      await db.insert(rolePermissions).values({ id: uuid(), role: 'CATALOG_MANAGER', permissionId });
      insertedCount++;
    }
  }
  console.log(`  → ${insertedCount} asignaciones rol-permiso nuevas.`);

  if (insertedCount > 0) {
    const [current] = await db.select().from(permissionsVersion).limit(1);
    if (current) {
      await db.update(permissionsVersion).set({ version: current.version + 1 }).where(eq(permissionsVersion.id, current.id));
      console.log(`  → permissions_version incrementada a ${current.version + 1}.`);
    }
  }
}

async function ensureSystemSettingsSingleton() {
  console.log('[3/3] Asegurando singleton system_settings...');
  const existing = await db.select().from(systemSettings).limit(1);
  if (existing.length === 0) {
    await db.insert(systemSettings).values({ id: uuid(), paymentModuleEnabled: false });
    console.log('  → singleton creado con payment_module_enabled=false.');
  } else {
    console.log('  → singleton ya existe.');
  }
}

async function main() {
  const allPermissions = await seedNewModules();
  await seedCatalogManagerPermissions(allPermissions);
  await ensureSystemSettingsSingleton();
  console.log('\n✅ Seed tareas/comentarios/pagos completado.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error en seed-tareas-pagos:', err);
    process.exit(1);
  });
