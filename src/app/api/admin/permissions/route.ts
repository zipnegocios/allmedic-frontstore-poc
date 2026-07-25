import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import {
  requireRole, ForbiddenError, getPermissionsMatrix, saveRolePermissions, EDITABLE_ROLES,
} from '@/lib/permissions';

export async function GET() {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'permisos', 'read');
    const matrix = await getPermissionsMatrix();
    return NextResponse.json(matrix);
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const SaveMatrixSchema = z.object({
  role: z.enum(EDITABLE_ROLES),
  granted: z.array(z.object({
    module: z.string().min(1),
    action: z.enum(['read', 'write']),
  })),
});

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin();
    await requireRole(session, 'permisos', 'write');
    const body = SaveMatrixSchema.parse(await request.json());

    await saveRolePermissions(body.role, body.granted);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    if (err instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
