import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { leads as leadsTable, whatsappClicks as whatsappClicksTable } from '@/db/schema';
import { z } from 'zod';
import { desc } from 'drizzle-orm';

const CreateLeadSchema = z.object({
  customerName: z.string().min(2),
  customerCity: z.string().min(2),
  customerPhone: z.string().optional(),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number().positive().int(),
    price: z.number().positive(),
  })),
  totalItems: z.number().positive().int(),
  subtotal: z.number().positive(),
});

/**
 * POST /api/leads
 * Creates a new lead from cart
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validatedData = CreateLeadSchema.parse(body);

    // Create lead in database
    const [lead] = await db.insert(leadsTable).values({
      customerName: validatedData.customerName,
      customerCity: validatedData.customerCity,
      customerPhone: validatedData.customerPhone,
      items: validatedData.items,
      totalItems: validatedData.totalItems,
      subtotal: validatedData.subtotal.toString(),
      status: 'SENT',
    }).returning();

    // Track WhatsApp click
    await db.insert(whatsappClicksTable).values({});

    return NextResponse.json(
      {
        success: true,
        leadId: lead.id,
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
