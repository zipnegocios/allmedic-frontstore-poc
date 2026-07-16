import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminAttributes, createAttribute } from '@/lib/admin-data-service';
import { z } from 'zod';

// Catálogo de `displayType` (decisión autónoma, ver brief 3.3): se limita a "select"
// (desplegable, el default heredado del esquema) y "buttons" (grupo de botones/chips
// para pocos valores, ej. tallas). Cubre los dos patrones de UI que ya existen en el
// catálogo público (selects de talla/color vs. filtros tipo chip) sin sobre-diseñar
// un catálogo mayor que ningún consumidor real pide todavía.
export const DISPLAY_TYPES = ['select', 'buttons'] as const;

const CreateAttributeSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  displayType: z.enum(DISPLAY_TYPES).default('select'),
  sortOrder: z.number().default(0),
  isActive: z.boolean().default(true),
});

export async function GET() {
  try {
    await requireAdmin();
    const attributes = await getAdminAttributes();
    return NextResponse.json({ attributes });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const validated = CreateAttributeSchema.parse(body);
    const attribute = await createAttribute(validated);
    return NextResponse.json(attribute, { status: 201 });
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
