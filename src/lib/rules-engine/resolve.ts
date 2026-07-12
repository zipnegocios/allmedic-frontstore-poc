import type {
  BusinessRule,
  RuleContext,
  RuleType,
  RuleScope,
  ResolvedRules,
  MinQuantityConfig,
  MultiplesOnlyConfig,
  QuantityRangeConfig,
  SizeModeConfig,
  PriceVisibilityConfig,
  InventoryModeConfig,
  VolumeScaleConfig,
  PromoConfig,
  ResolvedPromo,
  ColorRestrictionConfig,
  VolumeDiscountRetailConfig,
} from "./types";
import {
  DEFAULT_MIN_QUANTITY,
  DEFAULT_SIZE_MODE,
  DEFAULT_PRICE_VISIBILITY,
  DEFAULT_INVENTORY_MODE,
} from "./defaults";

// Orden de precedencia: lo más específico gana.
const SCOPE_PRECEDENCE: RuleScope[] = ["PRODUCT", "SET", "SET_GROUP", "BRAND", "GLOBAL"];

function toDate(value?: Date | string | null): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

/** Exportada para uso fuera de la resolución jerárquica normal — `pricing.ts` la reutiliza para
 * los tipos de PROMO de nivel carrito (THRESHOLD_DISCOUNT, GIFT, COMBO), que se evalúan contra
 * `allRules` directamente en vez de vía `resolveRules`. */
export function isRuleActive(rule: BusinessRule, now: Date): boolean {
  if (!rule.isActive) return false;
  const from = toDate(rule.validFrom);
  const to = toDate(rule.validTo);
  if (from && now < from) return false;
  if (to && now > to) return false;
  return true;
}

function scopeMatchesContext(rule: BusinessRule, context: RuleContext): boolean {
  switch (rule.scope) {
    case "GLOBAL":
      return true;
    case "BRAND":
      return !!context.brandId && rule.scopeId === context.brandId;
    case "SET_GROUP":
      return !!context.setGroupId && rule.scopeId === context.setGroupId;
    case "SET":
      return !!context.setId && rule.scopeId === context.setId;
    case "PRODUCT":
      return !!context.productId && rule.scopeId === context.productId;
    default:
      return false;
  }
}

function candidatesFor(
  rules: BusinessRule[],
  ruleType: RuleType,
  context: RuleContext,
  now: Date
): BusinessRule[] {
  return rules.filter(
    (r) => r.ruleType === ruleType && isRuleActive(r, now) && scopeMatchesContext(r, context)
  );
}

/** Devuelve la regla activa más específica para un tipo dado (single-value rule types). */
function pickBestRule(
  rules: BusinessRule[],
  ruleType: RuleType,
  context: RuleContext,
  now: Date
): BusinessRule | undefined {
  const candidates = candidatesFor(rules, ruleType, context, now);
  for (const scope of SCOPE_PRECEDENCE) {
    const atScope = candidates.filter((r) => r.scope === scope);
    if (atScope.length > 0) {
      return atScope.reduce((best, r) => (r.priority > best.priority ? r : best));
    }
  }
  return undefined;
}

/** Devuelve TODAS las reglas activas aplicables para tipos multi-instancia (promos, restricciones de color). */
function pickAllRules(
  rules: BusinessRule[],
  ruleType: RuleType,
  context: RuleContext,
  now: Date
): BusinessRule[] {
  return candidatesFor(rules, ruleType, context, now);
}

export function resolveRules(
  rules: BusinessRule[],
  context: RuleContext,
  now: Date = new Date()
): ResolvedRules {
  const minQuantityRule = pickBestRule(rules, "MIN_QUANTITY", context, now);
  const multiplesRule = pickBestRule(rules, "MULTIPLES_ONLY", context, now);
  const rangeRule = pickBestRule(rules, "QUANTITY_RANGE", context, now);
  const sizeModeRule = pickBestRule(rules, "SIZE_MODE", context, now);
  const priceVisibilityRule = pickBestRule(rules, "PRICE_VISIBILITY", context, now);
  const inventoryModeRule = pickBestRule(rules, "INVENTORY_MODE", context, now);
  const volumeScaleRule = pickBestRule(rules, "VOLUME_SCALE", context, now);
  const volumeDiscountRetailRule = pickBestRule(rules, "VOLUME_DISCOUNT_RETAIL", context, now);

  const promoRules = pickAllRules(rules, "PROMO", context, now);
  const colorRestrictionRules = pickAllRules(rules, "COLOR_RESTRICTION", context, now);

  return {
    minQuantity: (minQuantityRule?.config as unknown as MinQuantityConfig) ?? DEFAULT_MIN_QUANTITY,
    multiplesOnly: (multiplesRule?.config as unknown as MultiplesOnlyConfig) ?? null,
    quantityRange: (rangeRule?.config as unknown as QuantityRangeConfig) ?? null,
    sizeMode: (sizeModeRule?.config as unknown as SizeModeConfig) ?? DEFAULT_SIZE_MODE,
    priceVisibility:
      (priceVisibilityRule?.config as unknown as PriceVisibilityConfig) ?? DEFAULT_PRICE_VISIBILITY,
    inventoryMode: (inventoryModeRule?.config as unknown as InventoryModeConfig) ?? DEFAULT_INVENTORY_MODE,
    volumeScale: (volumeScaleRule?.config as unknown as VolumeScaleConfig) ?? null,
    promos: promoRules.map((r): ResolvedPromo => ({ id: r.id, name: r.name, config: r.config as unknown as PromoConfig })),
    colorRestrictions: colorRestrictionRules.map((r) => r.config as unknown as ColorRestrictionConfig),
    volumeDiscountRetail:
      (volumeDiscountRetailRule?.config as unknown as VolumeDiscountRetailConfig) ?? null,
  };
}
