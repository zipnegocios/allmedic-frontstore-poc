import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getProductTypeAttributes, addProductTypeAttribute, removeProductTypeAttribute } from '@/lib/admin-data-service';
import { z } from 'zod';

// Decisión de forma de API (Fase 3.2, ver brief): la asociación producto-tipo↔atributo
// se gestiona con GET (lista con isRequired/sortOrder resueltos), POST (upsert
// idempotente: crea o actualiza isRequired/sortOrder si la asociación ya existe) y
// DELETE (recibe attributeId por query string, ya que la asociación no tiene su
// propia página de detalle ni necesita un id de recurso propio en la URL).

const AssociateAttributeSchema = z.object({
  attributeId: z.string().min(1),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().default(0),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const attributes = await getProductTypeAttributes(id);
    return NextResponse.json({ attributes });
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
    const { attributeId, isRequired, sortOrder } = AssociateAttributeSchema.parse(body);
    const link = await addProductTypeAttribute(id, attributeId, isRequired, sortOrder);
    return NextResponse.json(link, { status: 201 });
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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const attributeId = searchParams.get('attributeId');
    if (!attributeId) {
      return NextResponse.json({ error: 'Validation error', details: 'attributeId es requerido' }, { status: 400 });
    }
    await removeProductTypeAttribute(id, attributeId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
