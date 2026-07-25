import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminColors, getAdminColorsForBrand, getAdminColorsNotInBrand, createColor, activateColorBrand } from '@/lib/admin-data-service';
import { z } from 'zod';

const CreateColorSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  hex: z.string().min(1),
  kind: z.enum(['SOLID', 'PATTERN']).default('SOLID'),
  swatchAssetId: z.string().optional(),
  /** Si viene, el color recién creado se auto-vincula a esta marca (alta rápida desde
   * el formulario de producto — ver `ColorFormDialog`) para que aparezca de inmediato
   * en el picker filtrado por marca de quien lo creó. */
  brandId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const brandId = searchParams.get('brandId') || undefined;
    const excludeBrandId = searchParams.get('excludeBrandId') || undefined;
    // Filtros de `/admin/colores` (catálogo maestro) — distintos de `brandId`, que es
    // el modo estricto del picker de producto (ver rama de abajo). `kind` filtra por
    // tipo (SOLID/PATTERN); `brandFilterId` filtra por una marca activada en ese color,
    // sin restringir la respuesta a los campos reducidos de `getAdminColorsForBrand`.
    const kind = searchParams.get('kind') || undefined;
    const brandFilterId = searchParams.get('brandFilterId') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // El picker de color del formulario de producto pide `?brandId=` para filtrar
    // estricto a los colores activados de esa marca — sin paginar, es una lista corta.
    if (brandId) {
      const colors = await getAdminColorsForBrand(brandId);
      return NextResponse.json({ colors, total: colors.length, pages: 1 });
    }

    // El modal "Asociar color" del generador de matriz pide `?excludeBrandId=` para
    // listar solo colores AÚN NO vinculados a esa marca (no tiene sentido reasociar
    // uno que ya lo está) — sin paginar, con búsqueda opcional server-side.
    if (excludeBrandId) {
      const colors = await getAdminColorsNotInBrand(excludeBrandId, search);
      return NextResponse.json({ colors, total: colors.length, pages: 1 });
    }

    const allColors = await getAdminColors();

    let filtered = allColors;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
      );
    }
    if (kind) {
      filtered = filtered.filter(c => c.kind === kind);
    }
    if (brandFilterId) {
      filtered = filtered.filter(c => c.brandIds.includes(brandFilterId));
    }

    const total = filtered.length;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      colors: paginated,
      total,
      pages: Math.ceil(total / limit),
    });
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
    const { swatchAssetId, brandId, ...validated } = CreateColorSchema.parse(body);
    const color = await createColor(validated, swatchAssetId);
    if (brandId) await activateColorBrand(color.id, brandId);
    return NextResponse.json(color, { status: 201 });
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
