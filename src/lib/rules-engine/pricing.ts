import type {
  BusinessRule,
  CorporateCart,
  CorporateCartItem,
  PricingResult,
  PromoBreakdownEntry,
  PromoComboConfig,
  PromoGiftConfig,
  PromoThresholdDiscountConfig,
  SetMeta,
  SetPriceInfo,
} from "./types";
import { resolveRules, isRuleActive } from "./resolve";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** true si `item` cae dentro del ámbito de `rule` — usado por los tipos de PROMO de nivel
 * carrito (THRESHOLD_DISCOUNT, GIFT), que no se resuelven vía `resolveRules` (esa función
 * devuelve LA regla más específica para un contexto puntual; aquí necesitamos, al revés,
 * TODOS los ítems que caen bajo el ámbito de una regla concreta). */
function itemInRuleScope(rule: BusinessRule, item: CorporateCartItem, setMeta: Record<string, SetMeta>): boolean {
  const meta = setMeta[item.setId] ?? {};
  switch (rule.scope) {
    case "GLOBAL":
      return true;
    case "BRAND":
      return !!meta.brandId && meta.brandId === rule.scopeId;
    case "SET_GROUP":
      return !!meta.setGroupId && meta.setGroupId === rule.scopeId;
    case "SET":
      return item.setId === rule.scopeId;
    default:
      return false; // PRODUCT no soportado para los tipos de PROMO de nivel carrito
  }
}

/**
 * Calcula subtotales, escala de volumen, promociones y total referencial de un
 * carrito corporativo. Se usa IDÉNTICO en cliente (preview) y servidor (fuente de
 * verdad) — sin efectos secundarios, solo funciones puras sobre los datos recibidos.
 *
 * Orden de aplicación de PROMO (documentado en RULE_DOCS.PROMO):
 *   (a) tipos por ítem (N_PLUS_ONE, PERCENT_OFF, FIXED_AMOUNT_OFF, FIXED_PRICE, NTH_UNIT_PCT)
 *   (b) COMBO (cruzada entre ítems, solo GLOBAL)
 *   (c) THRESHOLD_DISCOUNT (nivel carrito/contexto, una sola vez por regla)
 *   (d) GIFT (informativa, no toca montos — solo agrega notas)
 * La escala de volumen (VOLUME_SCALE) se calcula antes y no cambia con esta ampliación.
 */
export function computeCartPricing(
  cart: CorporateCart,
  setPrices: Record<string, SetPriceInfo>,
  allRules: BusinessRule[],
  setMeta: Record<string, SetMeta> = {},
  now: Date = new Date()
): PricingResult {
  const lines = cart.items.map((item) => {
    const quantity = item.lines.reduce((sum, line) => sum + line.quantity, 0);
    const priceInfo = setPrices[item.setId];
    const unitPrice = priceInfo?.pricePerSet ?? 0;
    return {
      setId: item.setId,
      quantity,
      unitPrice,
      lineSubtotal: round2(unitPrice * quantity),
    };
  });

  const hasMissingPrices = cart.items.some((item) => setPrices[item.setId]?.hasMissingPrices ?? true);

  const subtotalBeforeDiscount = round2(lines.reduce((sum, l) => sum + l.lineSubtotal, 0));
  const totalSets = cart.items.reduce(
    (sum, item) => sum + item.lines.reduce((lineSum, line) => lineSum + line.quantity, 0),
    0
  );

  // Escala de volumen resuelta a nivel GLOBAL (MVP — no diferenciada por set/marca) — sin cambios.
  const resolved = resolveRules(allRules, {}, now);
  let volumeDiscountPct = 0;
  if (resolved.volumeScale) {
    const applicableTiers = resolved.volumeScale.tiers
      .filter((t) => totalSets >= t.minQty)
      .sort((a, b) => b.minQty - a.minQty);
    if (applicableTiers.length > 0) {
      volumeDiscountPct = applicableTiers[0].discountPct;
    }
  }
  const volumeDiscountAmount = round2(subtotalBeforeDiscount * (volumeDiscountPct / 100));

  const promoBreakdown: PromoBreakdownEntry[] = [];
  const promoNotes: string[] = [];

  // Descuento acumulado por set — tope: nunca supera el lineSubtotal de ESE set.
  const perSetDiscount = new Map<string, number>();
  function addDiscount(setId: string, ruleId: string, ruleName: string, kind: PromoBreakdownEntry["kind"], rawAmount: number) {
    if (rawAmount <= 0) return;
    const line = lines.find((l) => l.setId === setId);
    if (!line) return;
    const already = perSetDiscount.get(setId) ?? 0;
    const applied = round2(Math.max(0, Math.min(rawAmount, line.lineSubtotal - already)));
    if (applied <= 0) return;
    perSetDiscount.set(setId, already + applied);
    promoBreakdown.push({ ruleId, ruleName, kind, amount: applied });
  }

  // (a) PROMO por ítem: resuelta POR ÍTEM (setId/setGroupId/brandId), a diferencia de la escala
  // de volumen que es GLOBAL — así una promo de ámbito SET solo descuenta en el set al que
  // pertenece. Los tipos multi-instancia (varias promos activas a la vez) se acumulan.
  for (const item of cart.items) {
    const meta = setMeta[item.setId] ?? {};
    const itemResolved = resolveRules(
      allRules,
      { setId: item.setId, setGroupId: meta.setGroupId, brandId: meta.brandId },
      now
    );
    const itemQty = item.lines.reduce((sum, line) => sum + line.quantity, 0);
    const unitPrice = setPrices[item.setId]?.pricePerSet ?? 0;
    const lineSubtotal = round2(unitPrice * itemQty);

    for (const { id: ruleId, name: ruleName, config } of itemResolved.promos) {
      switch (config.kind) {
        case "N_PLUS_ONE": {
          if (config.buy > 0) {
            const cycles = Math.floor(itemQty / config.buy);
            addDiscount(item.setId, ruleId, ruleName, config.kind, cycles * config.free * unitPrice);
          }
          break;
        }
        case "PERCENT_OFF": {
          addDiscount(item.setId, ruleId, ruleName, config.kind, lineSubtotal * (config.pct / 100));
          break;
        }
        case "FIXED_AMOUNT_OFF": {
          addDiscount(item.setId, ruleId, ruleName, config.kind, itemQty * config.amountPerUnit);
          break;
        }
        case "FIXED_PRICE": {
          addDiscount(item.setId, ruleId, ruleName, config.kind, itemQty * Math.max(0, unitPrice - config.price));
          break;
        }
        case "NTH_UNIT_PCT": {
          if (config.n > 0) {
            const cycles = Math.floor(itemQty / config.n);
            addDiscount(item.setId, ruleId, ruleName, config.kind, cycles * unitPrice * (config.pct / 100));
          }
          break;
        }
        default:
          // THRESHOLD_DISCOUNT, GIFT y COMBO son de nivel carrito/cruzados — se evalúan
          // aparte más abajo, no por ítem (evita aplicarlos una vez por cada set del contexto).
          break;
      }
    }
  }

  // (b) COMBO — cruzada entre ítems, solo ámbito GLOBAL (validado en el schema/formulario).
  const comboRules = allRules.filter(
    (r) => r.ruleType === "PROMO" && isRuleActive(r, now) && (r.config as { kind?: string }).kind === "COMBO"
  );
  for (const rule of comboRules) {
    const config = rule.config as unknown as PromoComboConfig;
    const triggerQty = cart.items
      .filter((i) => i.setId === config.triggerSetId)
      .reduce((sum, i) => sum + i.lines.reduce((lineSum, l) => lineSum + l.quantity, 0), 0);
    if (triggerQty < config.triggerMinQty) continue;

    const targetLine = lines.find((l) => l.setId === config.targetSetId);
    if (!targetLine) continue; // el set objetivo no está en el carrito: la promo simplemente no aplica

    addDiscount(config.targetSetId, rule.id, rule.name, "COMBO", targetLine.lineSubtotal * (config.pct / 100));
  }

  // (c) THRESHOLD_DISCOUNT — nivel carrito/contexto: se evalúa sobre el subtotal (antes de
  // descuentos) de los ítems que caen dentro del ámbito de la regla, y aplica UNA SOLA VEZ por
  // regla (no por ítem). El tope natural de este tipo es el subtotal de su propio contexto, no
  // el lineSubtotal de un set individual (puede abarcar varios sets en BRAND/SET_GROUP).
  let thresholdDiscountTotal = 0;
  const thresholdRules = allRules.filter(
    (r) => r.ruleType === "PROMO" && isRuleActive(r, now) && (r.config as { kind?: string }).kind === "THRESHOLD_DISCOUNT"
  );
  for (const rule of thresholdRules) {
    const config = rule.config as unknown as PromoThresholdDiscountConfig;
    const contextItems = cart.items.filter((item) => itemInRuleScope(rule, item, setMeta));
    const contextSubtotal = round2(
      contextItems.reduce((sum, item) => sum + (lines.find((l) => l.setId === item.setId)?.lineSubtotal ?? 0), 0)
    );
    if (contextSubtotal < config.minSubtotal) continue;

    const rawAmount = config.pct !== undefined ? contextSubtotal * (config.pct / 100) : (config.amount ?? 0);
    const amount = round2(Math.min(rawAmount, contextSubtotal));
    if (amount <= 0) continue;

    thresholdDiscountTotal += amount;
    promoBreakdown.push({ ruleId: rule.id, ruleName: rule.name, kind: "THRESHOLD_DISCOUNT", amount });
  }

  // (d) GIFT — informativa, no toca ningún monto. Se evalúa igual que THRESHOLD (contexto de
  // la regla), pero solo produce una nota en `promoNotes` — depende de que ventas la honre.
  const giftRules = allRules.filter(
    (r) => r.ruleType === "PROMO" && isRuleActive(r, now) && (r.config as { kind?: string }).kind === "GIFT"
  );
  for (const rule of giftRules) {
    const config = rule.config as unknown as PromoGiftConfig;
    const contextItems = cart.items.filter((item) => itemInRuleScope(rule, item, setMeta));
    const contextQty = contextItems.reduce(
      (sum, item) => sum + item.lines.reduce((lineSum, l) => lineSum + l.quantity, 0),
      0
    );
    const contextSubtotal = contextItems.reduce(
      (sum, item) => sum + (lines.find((l) => l.setId === item.setId)?.lineSubtotal ?? 0),
      0
    );

    const meetsQty = config.minQty === undefined || contextQty >= config.minQty;
    const meetsSubtotal = config.minSubtotal === undefined || contextSubtotal >= config.minSubtotal;
    if (meetsQty && meetsSubtotal) {
      promoNotes.push(config.description);
    }
  }

  let promoDiscountAmount = round2(
    Array.from(perSetDiscount.values()).reduce((a, b) => a + b, 0) + thresholdDiscountTotal
  );
  // Tope global: el total del carrito nunca queda negativo, sin importar cuántas promos se acumulen.
  const maxPromoDiscount = Math.max(0, round2(subtotalBeforeDiscount - volumeDiscountAmount));
  if (promoDiscountAmount > maxPromoDiscount) {
    promoDiscountAmount = maxPromoDiscount;
  }

  const total = Math.max(0, round2(subtotalBeforeDiscount - volumeDiscountAmount - promoDiscountAmount));

  return {
    lines,
    subtotalBeforeDiscount,
    volumeDiscountPct,
    volumeDiscountAmount,
    promoDiscountAmount,
    promoBreakdown,
    promoNotes,
    total,
    hasMissingPrices,
  };
}
