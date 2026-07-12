// ─── Tipos del Motor de Reglas de Negocio ───
// Módulo puro y testeable — sin dependencias de base de datos ni de Next.js.

export type RuleType =
  | "MIN_QUANTITY"
  | "MULTIPLES_ONLY"
  | "QUANTITY_RANGE"
  | "SIZE_MODE"
  | "PRICE_VISIBILITY"
  | "INVENTORY_MODE"
  | "VOLUME_SCALE"
  | "PROMO"
  | "COLOR_RESTRICTION"
  | "VOLUME_DISCOUNT_RETAIL";

export type RuleScope = "GLOBAL" | "BRAND" | "SET_GROUP" | "SET" | "PRODUCT";

export type SizeMode = "MATRIX" | "PER_PIECE" | "NO_SIZES";
export type InventoryModeValue = "IGNORE" | "BLOCK" | "INFORMATIVE";
export type CountUnit = "SETS" | "PIECES";
export type PriceCatalog = "INDIVIDUAL" | "CORPORATE" | "BOTH";

// ─── Configuraciones por tipo de regla ───
export interface MinQuantityConfig {
  min: number;
  countUnit: CountUnit;
}

export interface MultiplesOnlyConfig {
  multipleOf: number;
}

export interface QuantityRangeConfig {
  min: number;
  max: number | null;
}

export interface SizeModeConfig {
  mode: SizeMode;
}

export interface PriceVisibilityConfig {
  showPrices: boolean;
  catalog: PriceCatalog;
}

export interface InventoryModeConfig {
  mode: InventoryModeValue;
}

export interface VolumeScaleTier {
  minQty: number;
  discountPct: number;
}

export interface VolumeScaleConfig {
  tiers: VolumeScaleTier[];
}

export interface PromoConfig {
  kind: "N_PLUS_ONE" | string;
  buy: number;
  free: number;
}

export interface ColorRestrictionConfig {
  colorCode: string;
  min: number;
}

export interface VolumeDiscountRetailTier {
  minItems: number;
  pct: number;
}

export interface VolumeDiscountRetailConfig {
  tiers: VolumeDiscountRetailTier[];
}

// ─── Regla de negocio (forma genérica, tal como llega de la BD) ───
export interface BusinessRule {
  id: string;
  name: string;
  ruleType: RuleType;
  scope: RuleScope;
  scopeId: string | null;
  config: Record<string, unknown>;
  isActive: boolean;
  priority: number;
  validFrom?: Date | string | null;
  validTo?: Date | string | null;
}

// ─── Contexto de resolución ───
export interface RuleContext {
  brandId?: string | null;
  setGroupId?: string | null;
  setId?: string | null;
  productId?: string | null;
}

// ─── Resultado de resolución: valores efectivos ya aplicados con jerarquía + defaults ───
export interface ResolvedRules {
  minQuantity: MinQuantityConfig;
  multiplesOnly: MultiplesOnlyConfig | null;
  quantityRange: QuantityRangeConfig | null;
  sizeMode: SizeModeConfig;
  priceVisibility: PriceVisibilityConfig;
  inventoryMode: InventoryModeConfig;
  volumeScale: VolumeScaleConfig | null;
  promos: PromoConfig[];
  colorRestrictions: ColorRestrictionConfig[];
  volumeDiscountRetail: VolumeDiscountRetailConfig | null;
}

// ─── Carrito corporativo (forma en memoria, coincide con corporate_carts.items) ───
export interface CorporateCartLine {
  size?: string;
  color?: string;
  pieceSelections?: Array<{ productId: string; size: string }>;
  quantity: number; // siempre en SETS
}

export interface CorporateCartItem {
  setId: string;
  setName?: string;
  sizeMode: SizeMode;
  lines: CorporateCartLine[];
}

export interface CorporateCart {
  items: CorporateCartItem[];
}

/** Una pieza (producto) dentro de la composición de un set — usada por INVENTORY_MODE
 * para saber qué producto(s) y en qué cantidad demanda cada unidad de set vendida. */
export interface SetPieceInfo {
  productId: string;
  productName?: string;
  quantityPerSet: number;
}

export interface SetMeta {
  setGroupId?: string | null;
  brandId?: string | null;
  /** Suma de `quantityPerSet` de todas las piezas del set — usado por MIN_QUANTITY
   * cuando `countUnit: "PIECES"` para convertir sets a piezas reales. */
  piecesPerSet?: number;
  /** Composición del set (productos + cantidad por set) — usada por INVENTORY_MODE
   * para calcular la demanda real de cada producto/talla. Opcional porque MIN_QUANTITY,
   * PROMO, etc. no la necesitan. */
  pieces?: SetPieceInfo[];
}

// ─── Resultado de validación de inventario (INVENTORY_MODE) ───
export type InventoryIssueSeverity = "BLOCK" | "INFORMATIVE";

export interface InventoryIssue {
  severity: InventoryIssueSeverity;
  code: "INVENTORY_INSUFFICIENT";
  setId: string;
  setName?: string;
  productId: string;
  productName?: string;
  /** null cuando el set no maneja tallas (SIZE_MODE: NO_SIZES) — la demanda se agrupa solo por producto. */
  size: string | null;
  /** Cuánto demanda ESTE ítem del carrito (puede ser menor a `groupDemand` si otros ítems comparten el mismo producto/talla). */
  demand: number;
  /** Demanda total agregada entre todos los ítems del carrito que comparten este producto/talla y cuyo modo efectivo no es IGNORE. */
  groupDemand: number;
  /** Stock disponible para este producto/talla, según el snapshot recibido. */
  available: number;
  message: string;
}

/** Snapshot de stock inyectado desde la capa de datos — el motor puro nunca consulta la BD.
 * Claves: `${productId}::${size}` para productos con talla, `${productId}` (sin `::`) para
 * el total agregado del producto (usado cuando SIZE_MODE es NO_SIZES). */
export type InventoryStockSnapshot = Record<string, number>;

// ─── Resultado de validación ───
export interface ValidationViolation {
  code: string;
  message: string;
  setId?: string;
}

export interface ValidationResult {
  canSubmit: boolean;
  violations: ValidationViolation[];
  totalSets: number;
  minRequired: number;
  setsRemaining: number;
  /** Unidad en la que están expresados `totalSets`/`minRequired`/`setsRemaining` —
   * "SETS" (comportamiento histórico) o "PIECES" cuando la regla MIN_QUANTITY activa
   * usa countUnit: "PIECES". La UI debe usar esta unidad para las etiquetas, no asumir "sets". */
  countUnit: CountUnit;
}

// ─── Resultado de precios ───
export interface SetPriceInfo {
  pricePerSet: number;
  hasMissingPrices: boolean;
}

export interface PricingLineResult {
  setId: string;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;
}

export interface PricingResult {
  lines: PricingLineResult[];
  subtotalBeforeDiscount: number;
  volumeDiscountPct: number;
  volumeDiscountAmount: number;
  promoDiscountAmount: number;
  total: number;
  hasMissingPrices: boolean;
}
