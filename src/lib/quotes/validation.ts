// ─── Esquema de validación del PATCH de cotizaciones ───
// Extraído de la route handler para poder testearlo de forma aislada (sin next/server ni BD).

import { z } from "zod";

// `pricingBreakdown` tiene dos formas legítimas (ver `QuoteItemPricingBreakdown` en
// `src/lib/quotes/pricing.ts`): array de ajustes del motor de reglas (líneas resueltas por
// `resolveSuggestedPrice`) o `{ composition }` con las piezas de un set armado en el carrito
// corporativo público (`POST /api/corporate/quotes`). El editor admin solo muestra/reenvía este
// campo sin transformarlo — debe aceptar ambas formas o el round-trip de guardado de una
// cotización creada desde el carrito público falla con 400.
export const PricingBreakdownSchema = z
  .union([
    z.array(z.object({ ruleId: z.string(), ruleName: z.string(), kind: z.string(), amount: z.number() })),
    z.object({ composition: z.array(z.object({ productId: z.string(), size: z.string().optional(), color: z.string().optional() })) }),
  ])
  .nullable()
  .optional();

export const QuoteItemSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["CATALOG", "FREE"]),
  productId: z.string().uuid().nullable().optional(),
  variantId: z.string().uuid().nullable().optional(),
  setId: z.string().uuid().nullable().optional(),
  size: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  description: z.string().min(1),
  quantity: z.number().min(1),
  suggestedUnitPrice: z.number().nullable().optional(),
  unitPrice: z.number().min(0),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).nullable().optional(),
  discountValue: z.number().min(0).optional(),
  taxRateOverride: z.number().nullable().optional(),
  pricingBreakdown: PricingBreakdownSchema,
  sortOrder: z.number(),
});

export const PatchQuoteSchema = z.object({
  customerName: z.string().min(1).optional(),
  customerIdNumber: z.string().nullable().optional(),
  customerContactName: z.string().nullable().optional(),
  customerEmail: z.string().nullable().optional(),
  customerPhone: z.string().nullable().optional(),
  customerAddress: z.string().nullable().optional(),
  customerCity: z.string().nullable().optional(),
  taxPresetId: z.string().uuid().nullable().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  pricesIncludeTax: z.boolean().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).nullable().optional(),
  discountValue: z.number().min(0).optional(),
  validityPresetId: z.string().uuid().nullable().optional(),
  validityDays: z.number().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(QuoteItemSchema).optional(),
  propagateToProfile: z.boolean().optional(),
});
