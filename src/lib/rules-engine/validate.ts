import type {
  BusinessRule,
  CorporateCart,
  SetMeta,
  ValidationResult,
  ValidationViolation,
} from "./types";
import { resolveRules } from "./resolve";

function pluralSets(n: number): string {
  return n === 1 ? "set" : "sets";
}

function pluralPieces(n: number): string {
  return n === 1 ? "pieza" : "piezas";
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

  // Total de sets en el carrito (unidad SETS, sumando todas las líneas de todos los items)
  const totalSets = cart.items.reduce(
    (sum, item) => sum + item.lines.reduce((lineSum, line) => lineSum + line.quantity, 0),
    0
  );

  // ── MIN_QUANTITY (resuelto a nivel GLOBAL — mínimo de carrito completo) ──
  const globalResolved = resolveRules(allRules, {}, now);
  const { min: minRequired, countUnit } = globalResolved.minQuantity;

  // countUnit: "PIECES" convierte la cantidad de sets de cada línea a piezas reales
  // usando `piecesPerSet` de `setMeta` (suma de quantityPerSet de las piezas del set).
  // Sin dato disponible, asume 1 pieza por set (fallback seguro — nunca bloquea de más).
  const totalForMinCheck =
    countUnit === "PIECES"
      ? cart.items.reduce((sum, item) => {
          const itemQty = item.lines.reduce((lineSum, line) => lineSum + line.quantity, 0);
          const piecesPerSet = setMeta[item.setId]?.piecesPerSet ?? 1;
          return sum + itemQty * piecesPerSet;
        }, 0)
      : totalSets;

  const setsRemaining = Math.max(0, minRequired - totalForMinCheck);
  const unitLabel = countUnit === "PIECES" ? pluralPieces(setsRemaining) : pluralSets(setsRemaining);
  const unitLabelRequired = countUnit === "PIECES" ? pluralPieces(minRequired) : pluralSets(minRequired);

  if (totalForMinCheck < minRequired) {
    violations.push({
      code: "MIN_QUANTITY",
      message: `Agrega ${setsRemaining} ${unitLabel} más para alcanzar el mínimo de ${minRequired} ${unitLabelRequired}.`,
    });
  }

  // ── Validaciones por set (estructurales + reglas específicas del set) ──
  for (const item of cart.items) {
    const meta = setMeta[item.setId] ?? {};
    const resolved = resolveRules(
      allRules,
      { setId: item.setId, setGroupId: meta.setGroupId, brandId: meta.brandId },
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

      // Estructura según sizeMode resuelto
      if (item.sizeMode === "MATRIX" && !line.size) {
        violations.push({
          code: "MISSING_SIZE",
          message: `Selecciona una talla para "${label}".`,
          setId: item.setId,
        });
      }
      if (item.sizeMode === "PER_PIECE" && (!line.pieceSelections || line.pieceSelections.length === 0)) {
        violations.push({
          code: "MISSING_PIECE_SELECTIONS",
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

      // COLOR_RESTRICTION
      if (line.color) {
        for (const restriction of resolved.colorRestrictions) {
          if (restriction.colorCode === line.color && line.quantity < restriction.min) {
            violations.push({
              code: "COLOR_RESTRICTION",
              message: `El color "${line.color}" en "${label}" requiere un mínimo de ${restriction.min} unidades.`,
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
