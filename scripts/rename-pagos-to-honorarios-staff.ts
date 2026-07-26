/**
 * Rename in-place del módulo de permiso 'pagos' -> 'honorarios-staff' (2026-07-26).
 * Uso: npx tsx scripts/rename-pagos-to-honorarios-staff.ts
 *
 * Se dejó "Pagos" libre para la futura integración con pasarela de pagos — este módulo es
 * exclusivamente el de pagos por productividad al staff interno (tiers, tarifas, períodos).
 *
 * UPDATE in-place sobre `permissions.module` (no insert+delete): conserva el mismo `id` de
 * cada fila, así que `role_permissions` (que referencia por `permissionId`, no por el string
 * `module`) no necesita ningún cambio — las asignaciones existentes (ej. CATALOG_MANAGER con
 * `pagos:read`, sembrada en scripts/seed-tareas-pagos.ts) heredan el nuevo nombre automático
 * vía el JOIN que ya hace `getPermissionsForRole`/`getPermissionsMatrix`.
 *
 * Idempotente: si ya no quedan filas con module='pagos', no hace nada.
 */
import 'dotenv/config';
import { db } from '@/db';
import { permissions, permissionsVersion } from '@/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('Renombrando módulo de permiso "pagos" -> "honorarios-staff"...');

  const result = await db
    .update(permissions)
    .set({ module: 'honorarios-staff' })
    .where(eq(permissions.module, 'pagos'))
    .returning();

  console.log(`  → ${result.length} fila(s) de permissions actualizadas.`);

  if (result.length > 0) {
    const [current] = await db.select().from(permissionsVersion).limit(1);
    if (current) {
      await db.update(permissionsVersion).set({ version: current.version + 1 }).where(eq(permissionsVersion.id, current.id));
      console.log(`  → permissions_version incrementada a ${current.version + 1}.`);
    } else {
      console.log('  ⚠ no existe fila en permissions_version — nada que incrementar.');
    }
  } else {
    console.log('  → nada que renombrar (ya migrado o nunca existió el módulo "pagos").');
  }

  console.log('\n✅ Rename completado.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error en rename-pagos-to-honorarios-staff:', err);
    process.exit(1);
  });
