// ─── CRUD de Cotizaciones (capa de datos) ───
// Consumido por las API routes de `/api/admin/quotes/**`. A diferencia del motor de reglas y
// de `pricing.ts`/`totals.ts`, este módulo SÍ depende de la base de datos (Drizzle).

import { eq, desc, and, or, ilike, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { quotes, quoteItems, corporateAccounts, leads, products, quoteDocuments } from "@/db/schema";
import { getAllBusinessRules, getSetPricesByIds, getSetMetaByIds } from "@/lib/corporate-data-service";
import { resolveSuggestedPrice, type QuoteLineContext, type QuoteItemPricingBreakdown } from "./pricing";
import { deleteObject } from "@/lib/r2";

export type QuoteChannel = "CORPORATE" | "RETAIL";
export type QuoteStatus = "DRAFT" | "FINAL";
export type QuoteOutcome = "ACCEPTED" | "REJECTED";
export type DiscountType = "PERCENTAGE" | "FIXED";
export type QuoteItemKind = "CATALOG" | "FREE";

export interface QuoteItemInput {
  id?: string; // presente al editar una línea existente; ausente = línea nueva
  kind: QuoteItemKind;
  productId?: string | null;
  variantId?: string | null;
  setId?: string | null;
  size?: string | null;
  color?: string | null;
  description: string;
  quantity: number;
  suggestedUnitPrice?: number | null;
  unitPrice: number;
  discountType?: DiscountType | null;
  discountValue?: number;
  taxRateOverride?: number | null;
  pricingBreakdown?: QuoteItemPricingBreakdown;
  sortOrder: number;
}

export interface CustomerSnapshotInput {
  customerName: string;
  customerIdNumber?: string | null;
  customerContactName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  customerCity?: string | null;
}

export interface CreateQuoteInput extends CustomerSnapshotInput {
  channel: QuoteChannel;
  accountId?: string | null;
  leadId?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  items?: QuoteItemInput[];
}

export async function createQuote(input: CreateQuoteInput) {
  const { items, ...quoteFields } = input;
  const [quote] = await db
    .insert(quotes)
    .values({ ...quoteFields, status: "DRAFT" })
    .returning();

  if (items && items.length > 0) {
    await replaceQuoteItems(quote.id, items);
  }

  return getQuoteById(quote.id);
}

export async function getQuoteById(id: string) {
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  if (!quote) return null;
  const items = await db
    .select()
    .from(quoteItems)
    .where(eq(quoteItems.quoteId, id))
    .orderBy(quoteItems.sortOrder);
  return { ...quote, items };
}

export interface ListQuotesFilters {
  status?: QuoteStatus;
  channel?: QuoteChannel;
  search?: string;
}

export async function listQuotes(filters: ListQuotesFilters = {}) {
  const conditions: any[] = [isNull(quotes.deletedAt)];
  if (filters.status) conditions.push(eq(quotes.status, filters.status));
  if (filters.channel) conditions.push(eq(quotes.channel, filters.channel));
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(or(ilike(quotes.customerName, term), ilike(quotes.quoteNumber, term)));
  }
  return db
    .select()
    .from(quotes)
    .where(and(...conditions))
    .orderBy(desc(quotes.createdAt));
}

interface LeadCartItem {
  productId?: string;
  variantId?: string;
  name: string;
  size?: string;
  color?: unknown;
  quantity: number;
  price: number;
}

/**
 * Crea una cotización BORRADOR a partir de un prospecto individual (`leads`), pre-cargando las
 * líneas desde `leads.items` (el snapshot del pedido original) y marcando el prospecto como
 * "COTIZADO" — todo en una transacción para que ninguna de las dos cosas quede a medias.
 */
export async function createQuoteFromLead(leadId: string) {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) return null;

  const items = (lead.items as unknown as LeadCartItem[]) ?? [];

  return db.transaction(async (tx) => {
    const [quote] = await tx
      .insert(quotes)
      .values({
        channel: "RETAIL",
        leadId: lead.id,
        customerName: lead.customerName,
        customerPhone: lead.customerPhone,
        customerCity: lead.customerCity,
        status: "DRAFT",
      })
      .returning();

    if (items.length > 0) {
      await tx.insert(quoteItems).values(
        items.map((item, index) => ({
          quoteId: quote.id,
          kind: "CATALOG" as const,
          productId: item.productId ?? null,
          variantId: item.variantId ?? null,
          size: item.size ?? null,
          color: typeof item.color === "string" ? item.color : null,
          description: item.name,
          quantity: item.quantity,
          suggestedUnitPrice: item.price.toFixed(2),
          unitPrice: item.price.toFixed(2),
          sortOrder: index,
        }))
      );
    }

    await tx.update(leads).set({ status: "COTIZADO" }).where(eq(leads.id, leadId));

    return quote;
  });
}

/**
 * Crea una cotización BORRADOR a partir de una cuenta corporativa, con el snapshot del cliente
 * pre-cargado desde la cuenta. No transiciona ningún estado de la cuenta (decisión de producto:
 * el canal corporativo no tiene etapa de "prospecto").
 */
export async function createQuoteFromAccount(accountId: string) {
  const [account] = await db.select().from(corporateAccounts).where(eq(corporateAccounts.id, accountId)).limit(1);
  if (!account) return null;

  const [quote] = await db
    .insert(quotes)
    .values({
      channel: "CORPORATE",
      accountId: account.id,
      customerName: account.razonSocial,
      customerIdNumber: account.ruc,
      customerContactName: account.contactName,
      customerEmail: account.email,
      customerPhone: account.phone,
      customerCity: account.city,
      status: "DRAFT",
    })
    .returning();

  return quote;
}

/** Todas las cotizaciones de un lead (prospecto individual) — a diferencia de
 * `getQuotesByAccountId` (portal del cliente), no filtra por publicación: el admin ve todo. */
export async function listQuotesByLeadId(leadId: string) {
  return db.select().from(quotes).where(and(eq(quotes.leadId, leadId), isNull(quotes.deletedAt))).orderBy(desc(quotes.createdAt));
}

/** Todas las cotizaciones de una cuenta corporativa, vista admin (sin filtrar por publicación). */
export async function listQuotesByAccountId(accountId: string) {
  return db.select().from(quotes).where(and(eq(quotes.accountId, accountId), isNull(quotes.deletedAt))).orderBy(desc(quotes.createdAt));
}

/** Reemplaza todas las líneas de una cotización — el editor guarda el estado completo de
 * líneas en cada `PATCH` (agregar/editar/eliminar/reordenar quedan resueltos por el cliente
 * mandando la lista final; más simple y consistente que endpoints granulares por línea). */
export async function replaceQuoteItems(quoteId: string, items: QuoteItemInput[]) {
  await db.delete(quoteItems).where(eq(quoteItems.quoteId, quoteId));
  if (items.length === 0) return;
  await db.insert(quoteItems).values(
    items.map((item, index) => ({
      quoteId,
      kind: item.kind,
      productId: item.productId ?? null,
      variantId: item.variantId ?? null,
      setId: item.setId ?? null,
      size: item.size ?? null,
      color: item.color ?? null,
      description: item.description,
      quantity: item.quantity,
      suggestedUnitPrice: item.suggestedUnitPrice != null ? item.suggestedUnitPrice.toFixed(2) : null,
      unitPrice: item.unitPrice.toFixed(2),
      discountType: item.discountType ?? null,
      discountValue: (item.discountValue ?? 0).toFixed(2),
      taxRateOverride: item.taxRateOverride != null ? item.taxRateOverride.toFixed(2) : null,
      pricingBreakdown: item.pricingBreakdown ?? null,
      sortOrder: item.sortOrder ?? index,
    }))
  );
}

export interface UpdateQuoteInput extends Partial<CustomerSnapshotInput> {
  taxPresetId?: string | null;
  taxRate?: number;
  pricesIncludeTax?: boolean;
  discountType?: DiscountType | null;
  discountValue?: number;
  validityPresetId?: string | null;
  validityDays?: number | null;
  expiresAt?: Date | null;
  notes?: string | null;
  items?: QuoteItemInput[];
  /** Totales ya recalculados por el caller (normalmente vía `computeQuoteTotals`) — se cachean
   * en la fila para que el listado no tenga que recalcular en cada render. */
  totals?: { subtotal: number; totalDiscount: number; totalTax: number; total: number };
  /** Si viene en true, además de actualizar el snapshot de esta cotización, propaga los campos
   * de cliente a la ficha origen (cuenta corporativa o prospecto). */
  propagateToProfile?: boolean;
}

export async function updateQuote(id: string, input: UpdateQuoteInput) {
  const current = await getQuoteById(id);
  if (!current) return null;

  const { items, totals, propagateToProfile, ...fields } = input;

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (key === "taxRate" || key === "discountValue") {
      patch[key] = (value as number).toFixed(2);
    } else {
      patch[key] = value;
    }
  }
  if (totals) {
    patch.subtotal = totals.subtotal.toFixed(2);
    patch.totalDiscount = totals.totalDiscount.toFixed(2);
    patch.totalTax = totals.totalTax.toFixed(2);
    patch.total = totals.total.toFixed(2);
  }

  await db.update(quotes).set(patch).where(eq(quotes.id, id));

  if (items) {
    await replaceQuoteItems(id, items);
  }

  if (propagateToProfile) {
    await propagateCustomerSnapshot(current, fields);
  }

  return getQuoteById(id);
}

async function propagateCustomerSnapshot(
  quote: NonNullable<Awaited<ReturnType<typeof getQuoteById>>>,
  fields: Partial<CustomerSnapshotInput>
) {
  if (quote.channel === "CORPORATE" && quote.accountId) {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (fields.customerName !== undefined) patch.razonSocial = fields.customerName;
    if (fields.customerIdNumber !== undefined) patch.ruc = fields.customerIdNumber;
    if (fields.customerContactName !== undefined) patch.contactName = fields.customerContactName;
    if (fields.customerEmail !== undefined) patch.email = fields.customerEmail;
    if (fields.customerPhone !== undefined) patch.phone = fields.customerPhone;
    if (fields.customerCity !== undefined) patch.city = fields.customerCity;
    await db.update(corporateAccounts).set(patch).where(eq(corporateAccounts.id, quote.accountId));
  } else if (quote.channel === "RETAIL" && quote.leadId) {
    const patch: Record<string, unknown> = {};
    if (fields.customerName !== undefined) patch.customerName = fields.customerName;
    if (fields.customerCity !== undefined) patch.customerCity = fields.customerCity;
    if (fields.customerPhone !== undefined) patch.customerPhone = fields.customerPhone;
    if (Object.keys(patch).length > 0) {
      await db.update(leads).set(patch).where(eq(leads.id, quote.leadId));
    }
  }
}

export async function deleteQuoteDraft(id: string) {
  const quote = await getQuoteById(id);
  if (!quote || quote.status !== "DRAFT") return false;
  await db.delete(quotes).where(eq(quotes.id, id));
  return true;
}

export async function setQuoteOutcome(id: string, outcome: QuoteOutcome) {
  const quote = await getQuoteById(id);
  if (!quote || quote.status !== "FINAL") return null;
  await db.update(quotes).set({ outcome, updatedAt: new Date() }).where(eq(quotes.id, id));
  return getQuoteById(id);
}

/** Recalcula `suggestedUnitPrice`/`pricingBreakdown` de todas las líneas CATALOG de la
 * cotización — nunca toca `unitPrice` (el precio ya fijado por el vendedor). Líneas FREE se
 * omiten (no tienen precio de catálogo que sugerir). */
export async function recalculateSuggested(id: string) {
  const quote = await getQuoteById(id);
  if (!quote) return null;

  const catalogItems = quote.items.filter((i) => i.kind === "CATALOG");
  const setIds = Array.from(new Set(catalogItems.filter((i) => i.setId).map((i) => i.setId!)));
  const productIds = Array.from(
    new Set(catalogItems.filter((i) => !i.setId && i.productId).map((i) => i.productId!))
  );

  const [allRules, setPrices, setMeta, productRows] = await Promise.all([
    getAllBusinessRules(),
    getSetPricesByIds(setIds),
    getSetMetaByIds(setIds),
    productIds.length > 0
      ? db.select().from(products).where(or(...productIds.map((pid) => eq(products.id, pid))))
      : Promise.resolve([]),
  ]);
  const productById = new Map(productRows.map((p) => [p.id, p]));

  for (const item of catalogItems) {
    let basePrice = 0;
    let context: QuoteLineContext;
    if (item.setId) {
      basePrice = setPrices[item.setId]?.pricePerSet ?? 0;
      const meta = setMeta[item.setId];
      context = {
        channel: quote.channel as QuoteChannel,
        quantity: item.quantity,
        basePrice,
        setId: item.setId,
        setGroupId: meta?.setGroupId,
        brandId: meta?.brandId,
      };
    } else if (item.productId) {
      const product = productById.get(item.productId);
      if (!product) continue;
      basePrice =
        quote.channel === "CORPORATE"
          ? Number(product.priceWholesaleSale ?? product.priceWholesale ?? 0)
          : Number(product.priceSale ?? product.priceNormal ?? 0);
      context = {
        channel: quote.channel as QuoteChannel,
        quantity: item.quantity,
        basePrice,
        productId: item.productId,
        brandId: product.brandId,
      };
    } else {
      continue;
    }

    const suggested = resolveSuggestedPrice(context, allRules);
    await db
      .update(quoteItems)
      .set({
        suggestedUnitPrice: suggested.suggestedUnitPrice.toFixed(2),
        pricingBreakdown: suggested.breakdown,
        updatedAt: new Date(),
      })
      .where(eq(quoteItems.id, item.id));
  }

  return getQuoteById(id);
}

export async function softDeleteQuote(id: string, deletedBy?: string | null) {
  await db
    .update(quotes)
    .set({
      deletedAt: new Date(),
      deletedBy: deletedBy || null,
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, id));
}

export async function restoreQuote(id: string) {
  await db
    .update(quotes)
    .set({
      deletedAt: null,
      deletedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, id));
}

export async function permanentlyDeleteQuote(id: string) {
  const quote = await getQuoteById(id);
  if (!quote) return false;

  // 1. Delete generated PDF in R2 if it exists
  if (quote.pdfKey) {
    try {
      await deleteObject(quote.pdfKey, "QUOTES");
    } catch (err) {
      console.error(`Error deleting PDF key ${quote.pdfKey} from R2:`, err);
    }
  }

  // 2. Delete quote documents (attachments) in R2
  const docs = await db.select().from(quoteDocuments).where(eq(quoteDocuments.quoteId, id));
  if (docs && docs.length > 0) {
    for (const doc of docs) {
      const quotesIdx = doc.fileUrl.indexOf("quotes/");
      if (quotesIdx !== -1) {
        const key = doc.fileUrl.substring(quotesIdx);
        try {
          await deleteObject(key, "MEDIA");
        } catch (err) {
          console.error(`Error deleting attachment key ${key} from R2:`, err);
        }
      }
    }
  }

  // 3. Delete from DB (quoteItems and quoteDocuments will be deleted by Cascade FKs)
  await db.delete(quotes).where(eq(quotes.id, id));
  return true;
}

export async function listTrashedQuotes() {
  return db
    .select()
    .from(quotes)
    .where(isNotNull(quotes.deletedAt))
    .orderBy(desc(quotes.deletedAt));
}

