import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import { db } from '@/db';
import { users, corporateAccounts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { uuid } from '@/lib/uuid';
import { isValidEcuadorRUC } from '@/lib/ruc-validator';
import { sendEmail, newRegistrationEmail, SALES_TEAM_EMAIL } from '@/lib/email';

const RegisterSchema = z.object({
  ruc: z.string().refine(isValidEcuadorRUC, 'RUC inválido — debe tener el formato de 13 dígitos de Ecuador'),
  razonSocial: z.string().min(1, 'Razón social requerida'),
  contactName: z.string().min(1, 'Nombre de contacto requerido'),
  email: z.string().email('Correo inválido'),
  phone: z.string().min(7, 'Teléfono inválido'),
  city: z.string().min(1, 'Ciudad requerida'),
  sector: z.string().optional(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = RegisterSchema.parse(body);

    const [existingAccount] = await db
      .select({ id: corporateAccounts.id })
      .from(corporateAccounts)
      .where(eq(corporateAccounts.email, validated.email))
      .limit(1);

    if (existingAccount) {
      return NextResponse.json(
        { error: 'Ya existe una cuenta corporativa registrada con este correo.' },
        { status: 409 }
      );
    }

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, validated.email))
      .limit(1);

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const hashedPassword = await hash(validated.password, 12);
      userId = uuid();
      await db.insert(users).values({
        id: userId,
        email: validated.email,
        name: validated.contactName,
        password: hashedPassword,
        role: 'CORPORATE_CLIENT',
      });
    }

    const [account] = await db
      .insert(corporateAccounts)
      .values({
        userId,
        ruc: validated.ruc,
        razonSocial: validated.razonSocial,
        contactName: validated.contactName,
        email: validated.email,
        phone: validated.phone,
        city: validated.city,
        sector: validated.sector,
        status: 'PENDING',
      })
      .returning();

    sendEmail({
      to: SALES_TEAM_EMAIL,
      ...newRegistrationEmail({
        razonSocial: validated.razonSocial,
        contactName: validated.contactName,
        ruc: validated.ruc,
        email: validated.email,
      }),
    }).catch(() => {});

    return NextResponse.json({ id: account.id, status: account.status }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
