import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { requireRole, ForbiddenError } from '@/lib/permissions';
import { getAdminUserById, updateAdminUser, deleteAdminUser, ProtectedUserError } from '@/lib/user-data-service';

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'SALES', 'CATALOG_MANAGER', 'DISPATCHER']).optional(),
  scopeLevel: z.enum(['OWN', 'ALL']).optional(),
  isActive: z.boolean().optional(),
  isTaskCoordinator: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'usuarios', 'write');
    const { id } = await params;
    const body = UpdateUserSchema.parse(await request.json());

    const updated = await updateAdminUser(id, body);
    if (!updated) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    if (err instanceof ProtectedUserError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'usuarios', 'write');
    const { id } = await params;

    const deleted = await deleteAdminUser(id);
    if (!deleted) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ProtectedUserError) return NextResponse.json({ error: err.message }, { status: 403 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'usuarios', 'read');
    const { id } = await params;
    const user = await getAdminUserById(id);
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    return NextResponse.json(user);
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
