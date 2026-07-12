// ─── Detector proactivo de conflictos entre reglas de negocio ───
// Módulo puro y testeable — sin dependencias de DB ni de Next.js.
//
// LIMITACIÓN DE DISEÑO CONOCIDA: este módulo no conoce la jerarquía real del catálogo
// (qué SET pertenece a qué BRAND o SET_GROUP) porque esa información vive en la base
// de datos. Por eso, las detecciones que comparan ámbitos distintos de GLOBAL entre sí
// (ej. una regla de una MARCA contra una regla de un SET específico) solo se evalúan con
// certeza cuando GLOBAL está involucrado (GLOBAL siempre se superpone con cualquier otro
// ámbito) o cuando el `scope`+`scopeId` son idénticos. Comparar dos ámbitos específicos
// distintos (BRAND vs SET) requeriría resolver la jerarquía real y se deja fuera para no
// dar falsos positivos/negativos — la capa API (fuera de este módulo) puede enriquecer
// esto en el futuro si hace falta.

import type { BusinessRule, RuleType } from "./types";

export type ConflictSeverity = "ERROR" | "WARNING" | "INFO";

export interface RuleConflict {
  severity: ConflictSeverity;
  code: string;
  message: string;
  conflictingRuleId?: string;
  conflictingRuleName?: string;
}

function toDate(value?: Date | string | null): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function isActiveNow(rule: BusinessRule, now: Date): boolean {
  if (!rule.isActive) return false;
  const from = toDate(rule.validFrom);
  const to = toDate(rule.validTo);
  if (from && now < from) return false;
  if (to && now > to) return false;
  return true;
}

/** Dos ventanas de vigencia se solapan si no hay un hueco garantizado entre ellas. */
function windowsOverlap(a: BusinessRule, b: BusinessRule): boolean {
  const aFrom = toDate(a.validFrom)?.getTime() ?? -Infinity;
  const aTo = toDate(a.validTo)?.getTime() ?? Infinity;
  const bFrom = toDate(b.validFrom)?.getTime() ?? -Infinity;
  const bTo = toDate(b.validTo)?.getTime() ?? Infinity;
  return aFrom <= bTo && bFrom <= aTo;
}

/**
 * Dos reglas "comparten contexto efectivo" si es seguro afirmar que ambas podrían
 * aplicar al mismo producto/set en algún momento — ver limitación de diseño arriba.
 * GLOBAL siempre se superpone con cualquier ámbito; fuera de eso, solo mismo scope+scopeId.
 */
function scopesOverlap(a: BusinessRule, b: BusinessRule): boolean {
  if (a.scope === "GLOBAL" || b.scope === "GLOBAL") return true;
  return a.scope === b.scope && a.scopeId === b.scopeId;
}

/** true si `a` es un ámbito más específico que `b` (a eclipsaría a b donde ambos aplican). */
function isMoreSpecific(a: BusinessRule, b: BusinessRule): boolean {
  return a.scope !== "GLOBAL" && b.scope === "GLOBAL";
}

function configsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isSameRuleIdentity(a: BusinessRule, b: BusinessRule): boolean {
  return a.ruleType === b.ruleType && a.scope === b.scope && a.scopeId === b.scopeId;
}

// ─── Detecciones estructurales (mismo tipo de regla) ───

function detectStructural(candidate: BusinessRule, existingRules: BusinessRule[], now: Date): RuleConflict[] {
  const conflicts: RuleConflict[] = [];
  // candidate.id === "" en modo creación — ninguna regla existente tiene id vacío,
  // así que el filtro no excluye nada de más en ese caso.
  const others = existingRules.filter((r) => r.id !== candidate.id);
  const sameType = others.filter((r) => r.ruleType === candidate.ruleType);

  // DUPLICATE_SAME_SCOPE
  for (const other of sameType) {
    if (!other.isActive) continue;
    if (!isSameRuleIdentity(candidate, other)) continue;
    if (!windowsOverlap(candidate, other)) continue;
    const samePriority = other.priority === candidate.priority;
    conflicts.push({
      severity: samePriority ? "ERROR" : "WARNING",
      code: "DUPLICATE_SAME_SCOPE",
      message: samePriority
        ? `Ya existe una regla activa "${other.name}" del mismo tipo, ámbito y prioridad. El desempate entre ambas es indefinido — cambia la prioridad o desactiva una de las dos.`
        : `Ya existe una regla activa "${other.name}" del mismo tipo y ámbito con prioridad ${other.priority}. ${other.priority > candidate.priority ? `"${other.name}"` : "Esta regla nueva"} ganará el desempate.`,
      conflictingRuleId: other.id,
      conflictingRuleName: other.name,
    });
  }

  // INACTIVE_TWIN
  for (const other of sameType) {
    if (other.isActive) continue;
    if (!isSameRuleIdentity(candidate, other)) continue;
    if (!configsEqual(other.config, candidate.config)) continue;
    conflicts.push({
      severity: "INFO",
      code: "INACTIVE_TWIN",
      message: `Existe una regla desactivada "${other.name}" idéntica a esta. Considera reactivarla en vez de crear una nueva.`,
      conflictingRuleId: other.id,
      conflictingRuleName: other.name,
    });
  }

  // SHADOWED_BY_SPECIFIC / SHADOWS_BROADER
  for (const other of sameType) {
    if (!isActiveNow(other, now)) continue;
    if (!windowsOverlap(candidate, other)) continue;

    if (isMoreSpecific(other, candidate)) {
      conflicts.push({
        severity: "INFO",
        code: "SHADOWED_BY_SPECIFIC",
        message: `La regla "${other.name}" (ámbito más específico) eclipsará a esta regla para el contexto donde ambas aplican.`,
        conflictingRuleId: other.id,
        conflictingRuleName: other.name,
      });
    } else if (isMoreSpecific(candidate, other)) {
      conflicts.push({
        severity: "INFO",
        code: "SHADOWS_BROADER",
        message: `Esta regla (ámbito más específico) eclipsará a la regla "${other.name}" para el contexto donde ambas aplican.`,
        conflictingRuleId: other.id,
        conflictingRuleName: other.name,
      });
    }
  }

  return conflicts;
}

// ─── Detecciones semánticas (entre tipos distintos, mismo contexto efectivo) ───

function relevantRulesOfType(
  candidate: BusinessRule,
  existingRules: BusinessRule[],
  ruleType: RuleType,
  now: Date
): BusinessRule[] {
  return existingRules.filter(
    (r) => r.ruleType === ruleType && r.id !== candidate.id && isActiveNow(r, now) && scopesOverlap(candidate, r)
  );
}

function detectSemantic(candidate: BusinessRule, existingRules: BusinessRule[], now: Date): RuleConflict[] {
  const conflicts: RuleConflict[] = [];
  const c = candidate.config as Record<string, unknown>;

  // MIN_ABOVE_RANGE_MAX (candidato MIN_QUANTITY vs QUANTITY_RANGE existentes, y viceversa)
  if (candidate.ruleType === "MIN_QUANTITY") {
    const min = Number(c.min);
    for (const other of relevantRulesOfType(candidate, existingRules, "QUANTITY_RANGE", now)) {
      const max = (other.config as Record<string, unknown>).max;
      if (max !== null && max !== undefined && min > Number(max)) {
        conflicts.push({
          severity: "ERROR",
          code: "MIN_ABOVE_RANGE_MAX",
          message: `El mínimo (${min}) supera el máximo permitido (${max}) por "${other.name}" — ninguna cantidad satisface ambas reglas a la vez.`,
          conflictingRuleId: other.id,
          conflictingRuleName: other.name,
        });
      }
    }
  }
  if (candidate.ruleType === "QUANTITY_RANGE") {
    const max = c.max;
    if (max !== null && max !== undefined) {
      for (const other of relevantRulesOfType(candidate, existingRules, "MIN_QUANTITY", now)) {
        const min = Number((other.config as Record<string, unknown>).min);
        if (min > Number(max)) {
          conflicts.push({
            severity: "ERROR",
            code: "MIN_ABOVE_RANGE_MAX",
            message: `El máximo (${max}) es menor al mínimo (${min}) exigido por "${other.name}" — ninguna cantidad satisface ambas reglas a la vez.`,
            conflictingRuleId: other.id,
            conflictingRuleName: other.name,
          });
        }
      }
    }
  }

  // MIN_NOT_MULTIPLE (candidato MIN_QUANTITY vs MULTIPLES_ONLY existentes, y viceversa)
  if (candidate.ruleType === "MIN_QUANTITY") {
    const min = Number(c.min);
    for (const other of relevantRulesOfType(candidate, existingRules, "MULTIPLES_ONLY", now)) {
      const multipleOf = Number((other.config as Record<string, unknown>).multipleOf);
      if (multipleOf > 0 && min % multipleOf !== 0) {
        const perceived = Math.ceil(min / multipleOf) * multipleOf;
        conflicts.push({
          severity: "WARNING",
          code: "MIN_NOT_MULTIPLE",
          message: `El mínimo (${min}) no es múltiplo de ${multipleOf} (exigido por "${other.name}") — el mínimo real que percibe el cliente será ${perceived}.`,
          conflictingRuleId: other.id,
          conflictingRuleName: other.name,
        });
      }
    }
  }
  if (candidate.ruleType === "MULTIPLES_ONLY") {
    const multipleOf = Number(c.multipleOf);
    for (const other of relevantRulesOfType(candidate, existingRules, "MIN_QUANTITY", now)) {
      const min = Number((other.config as Record<string, unknown>).min);
      if (multipleOf > 0 && min % multipleOf !== 0) {
        const perceived = Math.ceil(min / multipleOf) * multipleOf;
        conflicts.push({
          severity: "WARNING",
          code: "MIN_NOT_MULTIPLE",
          message: `El mínimo de "${other.name}" (${min}) no es múltiplo de ${multipleOf} — el mínimo real que percibe el cliente será ${perceived}.`,
          conflictingRuleId: other.id,
          conflictingRuleName: other.name,
        });
      }
    }
  }

  // RANGE_EXCLUDES_MULTIPLES (candidato QUANTITY_RANGE vs MULTIPLES_ONLY existentes, y viceversa)
  if (candidate.ruleType === "QUANTITY_RANGE") {
    const min = Number(c.min);
    const max = c.max;
    if (max !== null && max !== undefined) {
      for (const other of relevantRulesOfType(candidate, existingRules, "MULTIPLES_ONLY", now)) {
        const multipleOf = Number((other.config as Record<string, unknown>).multipleOf);
        if (multipleOf > 0) {
          const smallestMultiple = Math.ceil(min / multipleOf) * multipleOf;
          if (smallestMultiple > Number(max)) {
            conflicts.push({
              severity: "ERROR",
              code: "RANGE_EXCLUDES_MULTIPLES",
              message: `No existe ningún múltiplo de ${multipleOf} (exigido por "${other.name}") dentro del rango [${min}, ${max}] — el rango es inalcanzable.`,
              conflictingRuleId: other.id,
              conflictingRuleName: other.name,
            });
          }
        }
      }
    }
  }
  if (candidate.ruleType === "MULTIPLES_ONLY") {
    const multipleOf = Number(c.multipleOf);
    for (const other of relevantRulesOfType(candidate, existingRules, "QUANTITY_RANGE", now)) {
      const otherConfig = other.config as Record<string, unknown>;
      const min = Number(otherConfig.min);
      const max = otherConfig.max;
      if (multipleOf > 0 && max !== null && max !== undefined) {
        const smallestMultiple = Math.ceil(min / multipleOf) * multipleOf;
        if (smallestMultiple > Number(max)) {
          conflicts.push({
            severity: "ERROR",
            code: "RANGE_EXCLUDES_MULTIPLES",
            message: `No existe ningún múltiplo de ${multipleOf} dentro del rango de "${other.name}" [${min}, ${max}] — el rango es inalcanzable.`,
            conflictingRuleId: other.id,
            conflictingRuleName: other.name,
          });
        }
      }
    }
  }

  // PROMO_UNREACHABLE (candidato PROMO N_PLUS_ONE vs QUANTITY_RANGE existentes, y viceversa)
  // Solo aplica a N_PLUS_ONE — es el único tipo con un campo "buy" (cantidad exigida) que
  // pueda quedar fuera de un rango de cantidad. Los otros 7 tipos no tienen ese campo.
  if (candidate.ruleType === "PROMO" && c.kind === "N_PLUS_ONE") {
    const buy = Number(c.buy);
    for (const other of relevantRulesOfType(candidate, existingRules, "QUANTITY_RANGE", now)) {
      const max = (other.config as Record<string, unknown>).max;
      if (max !== null && max !== undefined && buy > Number(max)) {
        conflicts.push({
          severity: "WARNING",
          code: "PROMO_UNREACHABLE",
          message: `Esta promoción exige comprar ${buy} unidades, pero "${other.name}" limita el máximo a ${max} — la promoción nunca se activará.`,
          conflictingRuleId: other.id,
          conflictingRuleName: other.name,
        });
      }
    }
  }
  if (candidate.ruleType === "QUANTITY_RANGE") {
    const max = c.max;
    if (max !== null && max !== undefined) {
      for (const other of relevantRulesOfType(candidate, existingRules, "PROMO", now)) {
        const otherConfig = other.config as Record<string, unknown>;
        if (otherConfig.kind !== "N_PLUS_ONE") continue;
        const buy = Number(otherConfig.buy);
        if (buy > Number(max)) {
          conflicts.push({
            severity: "WARNING",
            code: "PROMO_UNREACHABLE",
            message: `La promoción "${other.name}" exige comprar ${buy} unidades, pero este rango limita el máximo a ${max} — la promoción nunca se activará.`,
            conflictingRuleId: other.id,
            conflictingRuleName: other.name,
          });
        }
      }
    }
  }

  // PROMO_DOUBLE_DISCOUNT (candidato FIXED_PRICE vs PERCENT_OFF/FIXED_AMOUNT_OFF en el mismo
  // contexto, y viceversa) — combinar un precio fijo con un descuento porcentual/monto fijo sobre
  // ESE MISMO precio ya rebajado no es necesariamente un error, pero casi siempre es un despiste
  // del admin (dos promos "compitiendo" por el mismo margen) — se advierte, no se bloquea.
  const STACKABLE_WITH_FIXED_PRICE = ["PERCENT_OFF", "FIXED_AMOUNT_OFF"];
  if (candidate.ruleType === "PROMO" && c.kind === "FIXED_PRICE") {
    for (const other of relevantRulesOfType(candidate, existingRules, "PROMO", now)) {
      const otherKind = (other.config as Record<string, unknown>).kind;
      if (typeof otherKind === "string" && STACKABLE_WITH_FIXED_PRICE.includes(otherKind)) {
        conflicts.push({
          severity: "WARNING",
          code: "PROMO_DOUBLE_DISCOUNT",
          message: `Esta promoción fija un precio promocional, pero "${other.name}" aplica un descuento adicional sobre el mismo contexto — el cliente recibiría dos descuentos acumulados sobre el mismo set.`,
          conflictingRuleId: other.id,
          conflictingRuleName: other.name,
        });
      }
    }
  }
  if (candidate.ruleType === "PROMO" && typeof c.kind === "string" && STACKABLE_WITH_FIXED_PRICE.includes(c.kind)) {
    for (const other of relevantRulesOfType(candidate, existingRules, "PROMO", now)) {
      if ((other.config as Record<string, unknown>).kind === "FIXED_PRICE") {
        conflicts.push({
          severity: "WARNING",
          code: "PROMO_DOUBLE_DISCOUNT",
          message: `"${other.name}" ya fija un precio promocional en este contexto — esta promoción aplicaría un descuento adicional sobre ese precio, acumulando dos descuentos sobre el mismo set.`,
          conflictingRuleId: other.id,
          conflictingRuleName: other.name,
        });
      }
    }
  }

  // TIERS_BELOW_MIN (candidato VOLUME_SCALE vs MIN_QUANTITY existentes, y viceversa)
  if (candidate.ruleType === "VOLUME_SCALE") {
    const tiers = (c.tiers as Array<{ minQty: number; discountPct: number }>) ?? [];
    for (const other of relevantRulesOfType(candidate, existingRules, "MIN_QUANTITY", now)) {
      const min = Number((other.config as Record<string, unknown>).min);
      const belowMin = tiers.filter((t) => t.minQty < min);
      if (belowMin.length > 0) {
        conflicts.push({
          severity: "WARNING",
          code: "TIERS_BELOW_MIN",
          message: `${belowMin.length === 1 ? 'El tramo' : 'Los tramos'} con mínimo ${belowMin.map((t) => t.minQty).join(", ")} ${belowMin.length === 1 ? 'está' : 'están'} por debajo del mínimo exigido por "${other.name}" (${min}) — nunca se verá esa cantidad en un carrito enviado.`,
          conflictingRuleId: other.id,
          conflictingRuleName: other.name,
        });
      }
    }
  }
  if (candidate.ruleType === "MIN_QUANTITY") {
    const min = Number(c.min);
    for (const other of relevantRulesOfType(candidate, existingRules, "VOLUME_SCALE", now)) {
      const tiers = ((other.config as Record<string, unknown>).tiers as Array<{ minQty: number; discountPct: number }>) ?? [];
      const belowMin = tiers.filter((t) => t.minQty < min);
      if (belowMin.length > 0) {
        conflicts.push({
          severity: "WARNING",
          code: "TIERS_BELOW_MIN",
          message: `"${other.name}" tiene ${belowMin.length === 1 ? 'un tramo' : 'tramos'} con mínimo ${belowMin.map((t) => t.minQty).join(", ")} por debajo de este mínimo (${min}) — nunca se verá esa cantidad en un carrito enviado.`,
          conflictingRuleId: other.id,
          conflictingRuleName: other.name,
        });
      }
    }
  }

  // TIERS_NOT_ASCENDING (intra-regla — VOLUME_SCALE y VOLUME_DISCOUNT_RETAIL)
  if (candidate.ruleType === "VOLUME_SCALE" || candidate.ruleType === "VOLUME_DISCOUNT_RETAIL") {
    const isRetail = candidate.ruleType === "VOLUME_DISCOUNT_RETAIL";
    const qtyKey = isRetail ? "minItems" : "minQty";
    const pctKey = isRetail ? "pct" : "discountPct";
    const tiers = (c.tiers as Array<Record<string, number>>) ?? [];

    let outOfOrder = tiers.length === 0;
    for (let i = 1; i < tiers.length; i++) {
      if (tiers[i][qtyKey] <= tiers[i - 1][qtyKey]) outOfOrder = true;
    }
    const pctOutOfRange = tiers.some((t) => t[pctKey] < 0 || t[pctKey] > 100);

    if (outOfOrder || pctOutOfRange) {
      conflicts.push({
        severity: "ERROR",
        code: "TIERS_NOT_ASCENDING",
        message: tiers.length === 0
          ? "Esta regla no tiene ningún tramo configurado."
          : outOfOrder
            ? "Los tramos deben estar en orden ascendente por cantidad mínima, sin duplicados."
            : "El porcentaje de descuento de cada tramo debe estar entre 0 y 100.",
      });
    }
  }

  // DISCOUNT_ON_HIDDEN_PRICES (descuentos vs PRICE_VISIBILITY oculto, en ambas direcciones)
  // PROMO GIFT queda fuera: es informativa, no tiene efecto monetario que "ocultar".
  const DISCOUNT_TYPES: RuleType[] = ["VOLUME_SCALE", "PROMO", "VOLUME_DISCOUNT_RETAIL"];
  const isMonetaryPromo = (rule: BusinessRule) =>
    rule.ruleType !== "PROMO" || (rule.config as Record<string, unknown>).kind !== "GIFT";
  if (DISCOUNT_TYPES.includes(candidate.ruleType) && isMonetaryPromo(candidate)) {
    for (const other of relevantRulesOfType(candidate, existingRules, "PRICE_VISIBILITY", now)) {
      const showPrices = (other.config as Record<string, unknown>).showPrices;
      if (showPrices === false) {
        conflicts.push({
          severity: "WARNING",
          code: "DISCOUNT_ON_HIDDEN_PRICES",
          message: `"${other.name}" oculta los precios en este contexto — el cliente no verá el beneficio de este descuento.`,
          conflictingRuleId: other.id,
          conflictingRuleName: other.name,
        });
      }
    }
  }
  if (candidate.ruleType === "PRICE_VISIBILITY" && c.showPrices === false) {
    for (const discountType of DISCOUNT_TYPES) {
      for (const other of relevantRulesOfType(candidate, existingRules, discountType, now)) {
        if (!isMonetaryPromo(other)) continue;
        conflicts.push({
          severity: "WARNING",
          code: "DISCOUNT_ON_HIDDEN_PRICES",
          message: `Esta regla oculta los precios donde "${other.name}" aplica un descuento — el cliente no verá su beneficio.`,
          conflictingRuleId: other.id,
          conflictingRuleName: other.name,
        });
      }
    }
  }

  return conflicts;
}

function detectExpiredOnCreate(candidate: BusinessRule, now: Date): RuleConflict[] {
  const to = toDate(candidate.validTo);
  if (to && now > to) {
    return [{
      severity: "WARNING",
      code: "EXPIRED_ON_CREATE",
      message: `La fecha 'Vigente hasta' (${to.toLocaleDateString("es-EC")}) ya pasó — esta regla nunca estará activa a menos que cambies la vigencia.`,
    }];
  }
  return [];
}

/**
 * Analiza una regla candidata (nueva o en edición) contra el resto de reglas existentes
 * y devuelve la lista de conflictos detectados. No tiene efectos secundarios ni acceso a DB.
 */
export function detectConflicts(
  candidate: BusinessRule,
  existingRules: BusinessRule[],
  now: Date = new Date()
): RuleConflict[] {
  return [
    ...detectStructural(candidate, existingRules, now),
    ...detectSemantic(candidate, existingRules, now),
    ...detectExpiredOnCreate(candidate, now),
  ];
}
