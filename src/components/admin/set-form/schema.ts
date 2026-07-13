import { z } from 'zod';
import type { RuleTypeKey } from '@/lib/rule-config-schemas';

// ─── Schemas ───
// Extraído de SetForm.tsx sin modificar reglas de validación: mismo
// esquema, misma fuente de verdad, reutilizado tanto por la vista desktop
// (Cards secuenciales) como por el wizard mobile (Task 8, Fase 3).

export const SetItemSchema = z.object({
  productId: z.string().min(1, 'Producto requerido'),
  quantityPerSet: z.coerce.number().min(1, 'Cantidad mínima 1'),
});

export const SetFormSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  slug: z.string().min(1, 'Slug requerido'),
  description: z.string().optional(),
  coverAssetId: z.string().optional(),
  imageUrl: z.string().optional(), // solo para previsualización, no se persiste
  setGroupId: z.string().optional(),
  brandId: z.string().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  priceManual: z.string().optional(),
  priceManualSale: z.string().optional(),
  manualDiscountEnd: z.string().optional(),
  items: z.array(SetItemSchema).min(1, 'Agrega al menos una pieza al set'),
});

export type SetFormData = z.infer<typeof SetFormSchema>;

// ─── Types ───

export interface SetGroup {
  id: string;
  name: string;
}

export interface Brand {
  id: string;
  name: string;
  isActive: boolean;
}

export interface EligibleProduct {
  id: string;
  name: string;
  slug: string;
  priceWholesale: string | null;
  priceWholesaleSale: string | null;
  priceNormal: string;
  visibility: 'INDIVIDUAL' | 'GROUPS' | 'BOTH';
  brandName: string | null;
  imageUrl: string | null;
  colors: { id: string; name: string; hex: string }[];
  sizes: string[];
  hasActiveVariant: boolean;
}

export interface SetRuleRow {
  id: string;
  name: string;
  ruleType: RuleTypeKey;
  scope: 'GLOBAL' | 'BRAND' | 'SET_GROUP' | 'SET' | 'PRODUCT';
  scopeId: string | null;
  isActive: boolean;
  priority: number;
  isWinner: boolean;
}

// ─── Constantes compartidas ───

export const SELECT_EMPTY_VALUE = '__empty__';

/** Precio efectivo de una pieza: rebajado al mayor si existe, si no el precio al mayor normal. */
export function productPrice(p: EligibleProduct | undefined): number | null {
  if (!p) return null;
  if (p.priceWholesaleSale) return Number(p.priceWholesaleSale);
  if (p.priceWholesale) return Number(p.priceWholesale);
  return null;
}
