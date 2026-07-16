import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAttributeValues, createAttributeValue } from '@/lib/admin-data-service';
import { z } from 'zod';

// Decisión de forma de API (Fase 3.3, ver brief): listar/crear valores vive anidado
// bajo el atributo (`/attributes/[id]/values`, coherente con `product-types/[id]/attributes`),
// mientras que actualizar/eliminar un valor puntual vive en `/attribute-values/[id]`
// (recurso propio con id global) — mismo criterio que usa `set-items` vs. `sets` en
// el resto del admin: la colección anidada solo necesita el id del padre para
// listar/crear, pero la edición de un ítem ya tiene su propio id único.

const CreateAttributeValueSchema = z.object({
  value: z.string().min(1),
  code: z.string().optional(),
  sortOrder: z.number().default(0),
  isActive: z.boolean().default(true),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const values = await getAttributeValues(id);
    return NextResponse.json({ values });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const validated = CreateAttributeValueSchema.parse(body);
    const value = await createAttributeValue({ ...validated, attributeId: id });
    return NextResponse.json(value, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
