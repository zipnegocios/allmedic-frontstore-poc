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

// ─── PROMO: unión discriminada por `kind` — 8 tipos de promoción ───
export type PromoKind =
  | "N_PLUS_ONE"
  | "PERCENT_OFF"
  | "FIXED_AMOUNT_OFF"
  | "FIXED_PRICE"
  | "NTH_UNIT_PCT"
  | "THRESHOLD_DISCOUNT"
  | "GIFT"
  | "COMBO";

/** Núcleo por ítem: por cada bloque completo de `buy` unidades del set, `free` unidades gratis. */
export interface PromoNPlusOneConfig {
  kind: "N_PLUS_ONE";
  buy: number;
  free: number;
}

/** Núcleo por ítem: `pct`% de descuento sobre el subtotal de la línea. */
export interface PromoPercentOffConfig {
  kind: "PERCENT_OFF";
  pct: number;
}

/** Núcleo por ítem: `amountPerUnit` de descuento por cada unidad, topado al subtotal de la línea. */
export interface PromoFixedAmountOffConfig {
  kind: "FIXED_AMOUNT_OFF";
  amountPerUnit: number;
}

/** Núcleo por ítem: precio promocional fijo por set — nunca encarece si es mayor al precio normal. */
export interface PromoFixedPriceConfig {
  kind: "FIXED_PRICE";
  price: number;
}

/** Núcleo por ítem: cada bloque completo de `n` unidades incluye 1 unidad con `pct`% de descuento. */
export interface PromoNthUnitPctConfig {
  kind: "NTH_UNIT_PCT";
  n: number;
  pct: number;
}

/** Nivel carrito: si el subtotal del contexto de la regla alcanza `minSubtotal`, aplica una sola
 * vez `pct`% o `amount` fijo (exactamente uno de los dos). */
export interface PromoThresholdDiscountConfig {
  kind: "THRESHOLD_DISCOUNT";
  minSubtotal: number;
  pct?: number;
  amount?: number;
}

/** Informativa: no altera el total. Si el contexto cumple `minQty` y/o `minSubtotal` (los que se
 * especifiquen), agrega `description` a `PricingResult.promoNotes`. */
export interface PromoGiftConfig {
  kind: "GIFT";
  minQty?: number;
  minSubtotal?: number;
  description: string;
}

/** Cruzada entre ítems, solo ámbito GLOBAL: si el carrito tiene ≥ `triggerMinQty` unidades de
 * `triggerSetId`, descuenta `pct`% del subtotal de `targetSetId` (si está en el carrito). */
export interface PromoComboConfig {
  kind: "COMBO";
  triggerSetId: string;
  triggerMinQty: number;
  targetSetId: string;
  pct: number;
}

export type PromoConfig =
  | PromoNPlusOneConfig
  | PromoPercentOffConfig
  | PromoFixedAmountOffConfig
  | PromoFixedPriceConfig
  | PromoNthUnitPctConfig
  | PromoThresholdDiscountConfig
  | PromoGiftConfig
  | PromoComboConfig;

/** Una regla PROMO ya resuelta, con la identidad de la regla preservada — `computeCartPricing`
 * la necesita para armar `PricingResult.promoBreakdown` (qué regla aportó qué monto). */
export interface ResolvedPromo {
  id: string;
  name: string;
  config: PromoConfig;
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
  /** Un único producto (ficha de producto individual, o compatibilidad con código existente). */
  productId?: string | null;
  /** Todos los productos relevantes del contexto — en el flujo corporativo, las piezas del set.
   * Una regla de ámbito PRODUCT aplica si su `scopeId` está entre estos ids. Si se omite, se usa
   * `[productId]` como fallback. */
  productIds?: string[];
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
  promos: ResolvedPromo[];
  colorRestrictions: ColorRestrictionConfig[];
  volumeDiscountRetail: VolumeDiscountRetailConfig | null;
}

// ─── Carrito corporativo (forma en memoria, coincide con corporate_carts.items) ───
// El armador de combinaciones es el único flujo de compra: cada fila del carrito es una
// combinación concreta con talla y color elegidos POR PIEZA. `SIZE_MODE` ya no cambia la forma
// de la línea — solo el comportamiento del armador (ver `SetDetailContent.tsx`): en `NO_SIZES`
// las piezas no llevan `size`; en `MATRIX`/`PER_PIECE` sí. El color por pieza es siempre opcional.
export interface CorporateCartLine {
  quantity: number; // siempre en SETS
  pieceSelections: Array<{ productId: string; size?: string; color?: string }>;
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
 * Claves: `${productId}::${size}::${color}` para una combinación exacta de talla y color,
 * `${productId}::${size}` para el total de esa talla agregado entre colores, y `${productId}`
 * para el total agregado del producto (usado cuando SIZE_MODE es NO_SIZES). */
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

/** Una entrada del desglose de promociones — qué regla aportó qué monto (excluye GIFT, que no
 * tiene efecto monetario y solo aparece en `promoNotes`). */
export interface PromoBreakdownEntry {
  ruleId: string;
  ruleName: string;
  kind: PromoKind;
  amount: number;
}

/** Una entrada del desglose de escala por volumen — qué regla (y en qué ámbito) aportó qué
 * monto. VOLUME_SCALE no se acumula: cada ítem del carrito cae bajo una sola regla ganadora
 * (la más específica), así que puede haber más de una entrada si distintos ítems del carrito
 * caen bajo escalas distintas (ej. una marca con escala propia y el resto en la escala Global). */
export interface VolumeScaleBreakdownEntry {
  ruleId: string;
  ruleName: string;
  scope: RuleScope;
  pct: number;
  amount: number;
}

export interface PricingResult {
  lines: PricingLineResult[];
  subtotalBeforeDiscount: number;
  volumeDiscountPct: number;
  volumeDiscountAmount: number;
  /** Desglose de qué regla de escala por volumen aportó qué monto — normalmente una sola entrada. */
  volumeScaleBreakdown: VolumeScaleBreakdownEntry[];
  promoDiscountAmount: number;
  /** Desglose de qué regla PROMO aportó qué monto — para mostrar detalle en el carrito. */
  promoBreakdown: PromoBreakdownEntry[];
  /** Notas informativas de promociones GIFT (sin efecto monetario) — deben mostrarse al cliente
   * y quedar en el snapshot de la cotización para que ventas las honre. */
  promoNotes: string[];
  total: number;
  hasMissingPrices: boolean;
}
