import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { getAdminUsers, createAdminUser } from '@/lib/user-data-service';

export async function GET() {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'usuarios', 'read');
    const users = await getAdminUsers();
    return NextResponse.json({ users });
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const CreateUserSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  email: z.string().email('Correo inválido'),
  role: z.enum(['ADMIN', 'SALES', 'CATALOG_MANAGER', 'DISPATCHER']),
  scopeLevel: z.enum(['OWN', 'ALL']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'usuarios', 'write');
    const body = CreateUserSchema.parse(await request.json());

    const { user, temporaryPassword } = await createAdminUser(body);
    return NextResponse.json({ user, temporaryPassword }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (message.includes('duplicate key') || message.includes('unique')) {
      return NextResponse.json({ error: 'Ya existe un usuario con ese correo' }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
