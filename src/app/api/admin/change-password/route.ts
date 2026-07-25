import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { changeOwnPassword } from '@/lib/user-data-service';

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

/** Usado por la pantalla obligatoria de cambio de contraseña (must_change_password),
 * pero también sirve para un cambio de contraseña voluntario desde cualquier sesión activa. */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as { id?: string }).id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { currentPassword, newPassword } = ChangePasswordSchema.parse(await request.json());
    const result = await changeOwnPassword(userId, currentPassword, newPassword);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
