/**
 * Script para crear el usuario administrador maestro.
 * Uso: npx tsx scripts/create-admin.ts
 */
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { hash } from 'bcryptjs';
import { uuid } from '@/lib/uuid';

async function main() {
  const email = 'allmedicuniforms@gmail.com';
  const name = 'masteradmin';
  const password = 'AMU.master26';
  const role = 'ADMIN';

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    console.log('Usuario ya existe. Actualizando contraseña y rol...');
    const hashed = await hash(password, 12);
    await db.update(users).set({ password: hashed, role, name }).where(eq(users.email, email));
    console.log('Usuario actualizado:', email);
    return;
  }

  const hashed = await hash(password, 12);
  const id = uuid();
  await db.insert(users).values({ id, email, name, password: hashed, role });
  console.log('Usuario admin creado:', { id, email, name, role });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
