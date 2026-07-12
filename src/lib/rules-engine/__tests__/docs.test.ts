import { describe, it, expect } from "vitest";
import { RULE_DOCS } from "../docs";
import type { RuleType } from "../types";

// Espejo deliberado de las interfaces de config en `types.ts` — si un campo cambia
// ahí sin actualizar este test, la desincronización se detecta aquí en vez de en
// producción. Ver comentario en `docs.ts`.
const CONFIG_KEYS: Record<RuleType, string[]> = {
  MIN_QUANTITY: ["min", "countUnit"],
  MULTIPLES_ONLY: ["multipleOf"],
  QUANTITY_RANGE: ["min", "max"],
  SIZE_MODE: ["mode"],
  PRICE_VISIBILITY: ["showPrices", "catalog"],
  INVENTORY_MODE: ["mode"],
  VOLUME_SCALE: ["tiers"],
  PROMO: [
    "kind", "buy", "free", "pct", "amountPerUnit", "price", "n",
    "minSubtotal", "amount", "minQty", "description", "triggerSetId", "triggerMinQty", "targetSetId",
  ],
  COLOR_RESTRICTION: ["colorCode", "min"],
  VOLUME_DISCOUNT_RETAIL: ["tiers"],
};

const ALL_RULE_TYPES = Object.keys(CONFIG_KEYS) as RuleType[];

describe("RULE_DOCS", () => {
  it("cubre los 10 tipos de regla, ni más ni menos", () => {
    expect(Object.keys(RULE_DOCS).sort()).toEqual(ALL_RULE_TYPES.sort());
  });

  it.each(ALL_RULE_TYPES)("cada fields[].key de %s existe en la config real de types.ts", (ruleType) => {
    const doc = RULE_DOCS[ruleType];
    const validKeys = CONFIG_KEYS[ruleType];
    for (const field of doc.fields) {
      expect(validKeys).toContain(field.key);
    }
  });

  it.each(ALL_RULE_TYPES)("%s tiene title, summary, detail y defaultBehavior no vacíos", (ruleType) => {
    const doc = RULE_DOCS[ruleType];
    expect(doc.title.length).toBeGreaterThan(0);
    expect(doc.summary.length).toBeGreaterThan(0);
    expect(doc.detail.length).toBeGreaterThan(0);
    expect(doc.defaultBehavior.length).toBeGreaterThan(0);
  });

  it("los tipos que siguen muertos tras el motor de inventario documentan appliesTo/supportedScopes vacíos", () => {
    // COLOR_RESTRICTION sigue ❌ Muerta (decisión de negocio: no vale la pena construir un
    // selector de color en esta fase). PROMO e INVENTORY_MODE se corrigieron y salieron de
    // esta lista — ver tests siguientes.
    for (const ruleType of ["COLOR_RESTRICTION"] as RuleType[]) {
      expect(RULE_DOCS[ruleType].appliesTo).toEqual([]);
      expect(RULE_DOCS[ruleType].supportedScopes).toEqual([]);
      expect(RULE_DOCS[ruleType].warnings.length).toBeGreaterThan(0);
    }
  });

  it("PROMO se corrigió en la Fase 3 y se amplió a 8 tipos después: ya no está en la lista de tipos muertos", () => {
    expect(RULE_DOCS.PROMO.appliesTo).toEqual(["CORPORATE"]);
    expect(RULE_DOCS.PROMO.supportedScopes.length).toBeGreaterThan(0);
    // Los warnings actuales documentan límites de diseño honestos (ej. GIFT sin efecto
    // monetario), no funcionalidad rota — a diferencia de los tipos ❌ Muertos de arriba.
    expect(RULE_DOCS.PROMO.examples.length).toBeGreaterThanOrEqual(8);
  });

  it("INVENTORY_MODE se implementó: ya no está en la lista de tipos muertos", () => {
    expect(RULE_DOCS.INVENTORY_MODE.appliesTo).toEqual(["CORPORATE"]);
    expect(RULE_DOCS.INVENTORY_MODE.supportedScopes.length).toBeGreaterThan(0);
    expect(RULE_DOCS.INVENTORY_MODE.examples.length).toBeGreaterThan(0);
  });

  it("select fields declaran una opción por cada valor válido del tipo union correspondiente", () => {
    const sizeModeField = RULE_DOCS.SIZE_MODE.fields.find((f) => f.key === "mode")!;
    expect(sizeModeField.options?.map((o) => o.value).sort()).toEqual(["MATRIX", "NO_SIZES", "PER_PIECE"]);

    const countUnitField = RULE_DOCS.MIN_QUANTITY.fields.find((f) => f.key === "countUnit")!;
    expect(countUnitField.options?.map((o) => o.value).sort()).toEqual(["PIECES", "SETS"]);

    const catalogField = RULE_DOCS.PRICE_VISIBILITY.fields.find((f) => f.key === "catalog")!;
    expect(catalogField.options?.map((o) => o.value).sort()).toEqual(["BOTH", "CORPORATE", "INDIVIDUAL"]);

    const inventoryModeField = RULE_DOCS.INVENTORY_MODE.fields.find((f) => f.key === "mode")!;
    expect(inventoryModeField.options?.map((o) => o.value).sort()).toEqual(["BLOCK", "IGNORE", "INFORMATIVE"]);
  });
});
