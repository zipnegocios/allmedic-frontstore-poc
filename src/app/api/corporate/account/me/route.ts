import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCorporateAccountByUserId } from '@/lib/corporate-data-service';

/** GET /api/corporate/account/me — Datos de la cuenta corporativa del usuario logueado (para prellenar formularios). */
export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ account: null });

  const account = await getCorporateAccountByUserId(userId);
  if (!account || account.status !== 'APPROVED') return NextResponse.json({ account: null });

  return NextResponse.json({
    account: {
      ruc: account.ruc,
      razonSocial: account.razonSocial,
      contactName: account.contactName,
      email: account.email,
      phone: account.phone,
      city: account.city,
      sector: account.sector,
    },
  });
}
