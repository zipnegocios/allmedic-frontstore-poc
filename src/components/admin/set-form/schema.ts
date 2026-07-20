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
  // Portadas primaria + secundaria — paridad exacta con productos: ambas
  // obligatorias para guardar/publicar, sin importar el modo usado para
  // elegirlas (subida especial o galería de las piezas del set).
  coverAssetId: z.string().min(1, 'La portada primaria es obligatoria'),
  coverAlt: z.string().optional(),
  imageUrl: z.string().optional(), // solo para previsualización, no se persiste
  secondaryCoverAssetId: z.string().min(1, 'La portada secundaria es obligatoria'),
  secondaryCoverAlt: z.string().optional(),
  secondaryImageUrl: z.string().optional(), // solo para previsualización, no se persiste
  // Modo de color del set — obligatorio y mutuamente excluyente. Sin elegirlo no se puede avanzar
  // del paso "Modo de color" (mobile) ni ver el paso "Piezas" (desktop). Ver ColorModeGate.
  colorMode: z.enum(['PAIRED', 'MIXED'], { message: 'Elige un modo de color para el set' }),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  priceManual: z.string().optional(),
  priceManualSale: z.string().optional(),
  manualDiscountEnd: z.string().optional(),
  items: z.array(SetItemSchema).min(1, 'Agrega al menos una pieza al set'),
});

export type SetFormData = z.infer<typeof SetFormSchema>;

// ─── Types ───

export interface EligibleProduct {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  sku: string | null;
  collectionName: string | null;
  priceWholesale: string | null;
  priceWholesaleSale: string | null;
  priceNormal: string;
  visibility: 'INDIVIDUAL' | 'GROUPS' | 'BOTH';
  brandName: string | null;
  imageUrl: string | null;
  colors: { id: string; name: string; code: string; hex: string }[];
  sizes: string[];
  hasActiveVariant: boolean;
}

// ─── Combinaciones de color curadas (modo MIXED) ───

export interface SetColorComboItemData {
  productId: string;
  colorCode: string;
}

export interface SetColorComboData {
  id: string;
  items: SetColorComboItemData[];
  isActive: boolean;
  sortOrder: number;
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
