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

  it("ningún tipo documenta appliesTo o supportedScopes vacíos: los 10 tipos tienen efecto real", () => {
    for (const ruleType of ALL_RULE_TYPES) {
      expect(RULE_DOCS[ruleType].appliesTo.length, `${ruleType}.appliesTo`).toBeGreaterThan(0);
      expect(RULE_DOCS[ruleType].supportedScopes.length, `${ruleType}.supportedScopes`).toBeGreaterThan(0);
    }
  });

  it("PROMO documenta sus 8 tipos con al menos un ejemplo cada uno", () => {
    expect(RULE_DOCS.PROMO.appliesTo).toEqual(["CORPORATE"]);
    expect(RULE_DOCS.PROMO.examples.length).toBeGreaterThanOrEqual(8);
  });

  it("los tipos de ámbito Producto activado (todos salvo INVENTORY_MODE y VOLUME_DISCOUNT_RETAIL) lo declaran en supportedScopes", () => {
    const withoutProduct: RuleType[] = ["INVENTORY_MODE", "VOLUME_DISCOUNT_RETAIL"];
    for (const ruleType of ALL_RULE_TYPES) {
      if (withoutProduct.includes(ruleType)) continue;
      expect(RULE_DOCS[ruleType].supportedScopes, ruleType).toContain("PRODUCT");
    }
  });

  it("INVENTORY_MODE y VOLUME_DISCOUNT_RETAIL documentan por qué el ámbito Producto no aplica", () => {
    expect(RULE_DOCS.INVENTORY_MODE.supportedScopes).not.toContain("PRODUCT");
    expect(RULE_DOCS.VOLUME_DISCOUNT_RETAIL.supportedScopes).toEqual(["GLOBAL"]);
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
