import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { leads as leadsTable, whatsappClicks as whatsappClicksTable } from '@/db/schema';
import { z } from 'zod';
import { desc } from 'drizzle-orm';

const LeadItemSchema = z.object({
  productId: z.string().optional(),
  variantId: z.string().optional(),
  name: z.string().min(1),
  brand: z.string().optional(),
  sku: z.string().optional(),
  color: z.unknown().optional(),
  size: z.string().optional(),
  fit: z.string().optional(),
  image: z.string().optional(),
  quantity: z.number().positive().int(),
  price: z.number().nonnegative(),
}).passthrough();

const CreateLeadSchema = z.object({
  customerName: z.string().min(2),
  customerCity: z.string().min(2),
  customerPhone: z.string().min(7).optional(),
  items: z.array(LeadItemSchema).min(1),
  totalItems: z.number().positive().int().optional(),
  subtotal: z.number().nonnegative().optional(),
  discountPct: z.number().min(0).max(100).optional(),
  discountAmount: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
});

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function getVolumeDiscountPct(totalItems: number): number {
  if (totalItems >= 10) return 20;
  if (totalItems >= 5) return 15;
  if (totalItems >= 3) return 10;
  return 0;
}

/**
 * POST /api/leads
 * Creates a new lead from cart
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validatedData = CreateLeadSchema.parse(body);

    // Recalcular totales en el servidor para no confiar en valores manipulables del cliente.
    const calculatedTotalItems = validatedData.items.reduce((sum, item) => sum + item.quantity, 0);
    const calculatedSubtotal = roundCurrency(
      validatedData.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    );
    const discountPct = getVolumeDiscountPct(calculatedTotalItems);
    const discountAmount = roundCurrency(calculatedSubtotal * (discountPct / 100));
    const total = roundCurrency(calculatedSubtotal - discountAmount);

    // Create lead in database
    const [lead] = await db.insert(leadsTable).values({
      customerName: validatedData.customerName,
      customerCity: validatedData.customerCity,
      customerPhone: validatedData.customerPhone,
      items: validatedData.items,
      totalItems: calculatedTotalItems,
      subtotal: calculatedSubtotal.toString(),
      discountPct,
      discountAmount: discountAmount.toString(),
      total: total.toString(),
      status: 'SENT',
    }).returning();

    // Registrar click de WhatsApp como best-effort para no bloquear la cotización.
    try {
      await db.insert(whatsappClicksTable).values({});
    } catch (trackingError) {
      console.warn('[POST /api/leads] Failed to track WhatsApp click', trackingError);
    }

    return NextResponse.json(
      {
        success: true,
        leadId: lead.id,
        totals: {
          totalItems: calculatedTotalItems,
          subtotal: calculatedSubtotal,
          discountPct,
          discountAmount,
          total,
        },
        message: 'Lead created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('[POST /api/leads]', error);
    return NextResponse.json(
      { error: 'Failed to create lead' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/leads
 * Get leads (admin only)
 */
export async function GET(_request: NextRequest) {
  try {
    // TODO: Add auth check here
    const leads = await db
      .select()
      .from(leadsTable)
      .orderBy(desc(leadsTable.createdAt))
      .limit(100);

    return NextResponse.json({ leads }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/leads]', error);
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}
