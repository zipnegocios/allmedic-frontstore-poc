import type {
  BusinessRule,
  CorporateCart,
  CorporateCartItem,
  CountUnit,
  MinQuantityConfig,
  SetMeta,
  ValidationResult,
  ValidationViolation,
} from "./types";
import { resolveRules, resolveContextualRule } from "./resolve";

function pluralSets(n: number): string {
  return n === 1 ? "set" : "sets";
}

function pluralPieces(n: number): string {
  return n === 1 ? "pieza" : "piezas";
}

function unitLabel(countUnit: CountUnit, n: number): string {
  return countUnit === "PIECES" ? pluralPieces(n) : pluralSets(n);
}

/** Suma la cantidad de un conjunto de ítems en la unidad pedida — "SETS" cuenta líneas tal cual,
 * "PIECES" las convierte a piezas reales vía `setMeta.piecesPerSet` (1 por defecto, fallback
 * seguro que nunca bloquea de más si el dato no está disponible). */
function sumForCountUnit(items: CorporateCartItem[], countUnit: CountUnit, setMeta: Record<string, SetMeta>): number {
  return items.reduce((sum, item) => {
    const itemQty = item.lines.reduce((lineSum, line) => lineSum + line.quantity, 0);
    if (countUnit !== "PIECES") return sum + itemQty;
    const piecesPerSet = setMeta[item.setId]?.piecesPerSet ?? 1;
    return sum + itemQty * piecesPerSet;
  }, 0);
}

/**
 * Valida un carrito corporativo completo contra el motor de reglas.
 * Devuelve violaciones en español, orientadas a la acción, y si se puede enviar la solicitud.
 */
export function validateCorporateCart(
  cart: CorporateCart,
  allRules: BusinessRule[],
  setMeta: Record<string, SetMeta> = {},
  now: Date = new Date()
): ValidationResult {
  const violations: ValidationViolation[] = [];

  // ── MIN_QUANTITY GLOBAL (mínimo del carrito completo) ──
  const globalResolved = resolveRules(allRules, {}, now);
  const { min: minRequired, countUnit } = globalResolved.minQuantity;
  const totalForMinCheck = sumForCountUnit(cart.items, countUnit, setMeta);
  const setsRemaining = Math.max(0, minRequired - totalForMinCheck);

  if (totalForMinCheck < minRequired) {
    violations.push({
      code: "MIN_QUANTITY",
      message: `Agrega ${setsRemaining} ${unitLabel(countUnit, setsRemaining)} más para alcanzar el mínimo de ${minRequired} ${unitLabel(countUnit, minRequired)}.`,
    });
  }

  // ── MIN_QUANTITY contextual (BRAND/SET_GROUP/SET/PRODUCT) ──
  // Un mínimo contextual restringe SU PROPIO subconjunto de ítems y se exige ADEMÁS del mínimo
  // GLOBAL — no lo reemplaza. Cada ítem del carrito puede caer bajo, como mucho, una regla
  // contextual (la más específica según la jerarquía); se agrupan los ítems por la regla que
  // efectivamente les aplica y se valida cada grupo contra su propio mínimo.
  const contextualGroups = new Map<string, { rule: BusinessRule; items: CorporateCartItem[] }>();
  for (const item of cart.items) {
    const meta = setMeta[item.setId] ?? {};
    const productIds = (meta.pieces ?? []).map((p) => p.productId);
    const winning = resolveContextualRule(
      allRules,
      "MIN_QUANTITY",
      { setId: item.setId, setGroupId: meta.setGroupId, brandId: meta.brandId, productIds },
      now
    );
    if (!winning) continue;
    if (!contextualGroups.has(winning.id)) contextualGroups.set(winning.id, { rule: winning, items: [] });
    contextualGroups.get(winning.id)!.items.push(item);
  }

  for (const { rule, items: groupItems } of contextualGroups.values()) {
    const config = rule.config as unknown as MinQuantityConfig;
    const groupTotal = sumForCountUnit(groupItems, config.countUnit, setMeta);
    if (groupTotal < config.min) {
      const remaining = config.min - groupTotal;
      violations.push({
        code: "MIN_QUANTITY",
        message: `"${rule.name}" requiere un mínimo de ${config.min} ${unitLabel(config.countUnit, config.min)}; llevas ${groupTotal} — agrega ${remaining} ${unitLabel(config.countUnit, remaining)} más.`,
      });
    }
  }

  // ── Validaciones por set (estructurales + reglas específicas del set) ──
  for (const item of cart.items) {
    const meta = setMeta[item.setId] ?? {};
    const productIds = (meta.pieces ?? []).map((p) => p.productId);
    const resolved = resolveRules(
      allRules,
      { setId: item.setId, setGroupId: meta.setGroupId, brandId: meta.brandId, productIds },
      now
    );

    const label = item.setName ?? item.setId;

    if (item.lines.length === 0) {
      violations.push({
        code: "EMPTY_SET",
        message: `El set "${label}" no tiene cantidades seleccionadas.`,
        setId: item.setId,
      });
      continue;
    }

    for (const line of item.lines) {
      // Cantidad debe ser positiva
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
        violations.push({
          code: "INVALID_QUANTITY",
          message: `La cantidad para "${label}" debe ser mayor a cero.`,
          setId: item.setId,
        });
        continue;
      }

      // Estructura: toda combinación necesita al menos una pieza seleccionada, y si el set
      // maneja tallas (todo modo salvo NO_SIZES), cada pieza de la combinación necesita talla.
      if (!line.pieceSelections || line.pieceSelections.length === 0) {
        violations.push({
          code: "MISSING_PIECE_SELECTIONS",
          message: `Arma al menos una combinación para "${label}".`,
          setId: item.setId,
        });
      } else if (item.sizeMode !== "NO_SIZES" && line.pieceSelections.some((sel) => !sel.size)) {
        violations.push({
          code: "MISSING_SIZE",
          message: `Selecciona la talla de cada pieza para "${label}".`,
          setId: item.setId,
        });
      }

      // MULTIPLES_ONLY
      if (resolved.multiplesOnly) {
        const { multipleOf } = resolved.multiplesOnly;
        if (multipleOf > 0 && line.quantity % multipleOf !== 0) {
          violations.push({
            code: "MULTIPLES_ONLY",
            message: `La cantidad para "${label}" debe ser múltiplo de ${multipleOf}.`,
            setId: item.setId,
          });
        }
      }

      // QUANTITY_RANGE
      if (resolved.quantityRange) {
        const { min, max } = resolved.quantityRange;
        if (line.quantity < min || (max !== null && line.quantity > max)) {
          const rangeText = max !== null ? `entre ${min} y ${max}` : `de al menos ${min}`;
          violations.push({
            code: "QUANTITY_RANGE",
            message: `La cantidad para "${label}" debe estar ${rangeText}.`,
            setId: item.setId,
          });
        }
      }

      // COLOR_RESTRICTION — se evalúa por fila × pieza: las unidades de UNA pieza en UN color
      // dentro de esta fila son `cantidadDeSets × quantityPerSet` de esa pieza. Nombra pieza,
      // color y mínimo exigido para que el usuario sepa exactamente qué ajustar.
      for (const sel of line.pieceSelections ?? []) {
        if (!sel.color) continue;
        const piece = (meta.pieces ?? []).find((p) => p.productId === sel.productId);
        const pieceLabel = piece?.productName ?? sel.productId;
        const qtyPerSet = piece?.quantityPerSet ?? 1;
        const units = line.quantity * qtyPerSet;
        for (const restriction of resolved.colorRestrictions) {
          if (restriction.colorCode === sel.color && units < restriction.min) {
            violations.push({
              code: "COLOR_RESTRICTION",
              message: `"${pieceLabel}" en color "${sel.color}" dentro de "${label}" requiere un mínimo de ${restriction.min} unidades; esta combinación lleva ${units}.`,
              setId: item.setId,
            });
          }
        }
      }
    }
  }

  return {
    canSubmit: violations.length === 0,
    violations,
    totalSets: totalForMinCheck,
    minRequired,
    setsRemaining,
    countUnit,
  };
}
