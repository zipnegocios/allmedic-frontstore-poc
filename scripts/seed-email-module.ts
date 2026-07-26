/**
 * Seed idempotente del módulo `correos` (panel de correos, 2026-07-25).
 * Uso: npx tsx scripts/seed-email-module.ts
 *
 * Cubre:
 * - Módulo nuevo (`correos`) en el catálogo maestro de permissions.
 * - No se concede a ningún rol editable — solo ADMIN accede (bypass total ya existente).
 * - Incrementa `permissions_version` para que el mapa nuevo aplique sin relogin.
 */
import 'dotenv/config';
import { db } from '@/db';
import { permissions, permissionsVersion } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { uuid } from '@/lib/uuid';

const ACTIONS = ['read', 'write'] as const;

async function main() {
  console.log('Sembrando módulo "correos"...');
  let inserted = 0;
  for (const action of ACTIONS) {
    const [existing] = await db.select().from(permissions).where(and(eq(permissions.module, 'correos'), eq(permissions.action, action))).limit(1);
    if (!existing) {
      await db.insert(permissions).values({ id: uuid(), module: 'correos', action });
      inserted++;
    }
  }
  console.log(`  → ${inserted} permisos nuevos insertados.`);

  if (inserted > 0) {
    const [current] = await db.select().from(permissionsVersion).limit(1);
    if (current) {
      await db.update(permissionsVersion).set({ version: current.version + 1 }).where(eq(permissionsVersion.id, current.id));
      console.log(`  → permissions_version incrementada a ${current.version + 1}.`);
    }
  }

  console.log('\n✅ Seed del módulo de correos completado.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error en seed-email-module:', err);
    process.exit(1);
  });
