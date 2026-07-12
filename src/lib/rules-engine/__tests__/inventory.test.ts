import { describe, it, expect } from "vitest";
import { checkInventory } from "../inventory";
import type { BusinessRule, CorporateCart, SetMeta } from "../types";

function rule(overrides: Partial<BusinessRule>): BusinessRule {
  return {
    id: overrides.id ?? "r1",
    name: overrides.name ?? "Regla de inventario",
    ruleType: overrides.ruleType ?? "INVENTORY_MODE",
    scope: overrides.scope ?? "GLOBAL",
    scopeId: overrides.scopeId ?? null,
    config: overrides.config ?? { mode: "BLOCK" },
    isActive: overrides.isActive ?? true,
    priority: overrides.priority ?? 0,
    validFrom: overrides.validFrom ?? null,
    validTo: overrides.validTo ?? null,
  };
}

const SET_A_META: Record<string, SetMeta> = {
  "set-a": {
    setGroupId: null,
    brandId: null,
    pieces: [{ productId: "prod-1", productName: "Camisa", quantityPerSet: 1 }],
  },
};

describe("checkInventory — modo IGNORE (default)", () => {
  it("no genera violaciones aunque el stock sea insuficiente", () => {
    const cart: CorporateCart = {
      items: [
        {
          setId: "set-a",
          setName: "Set A",
          sizeMode: "MATRIX",
          lines: [{ quantity: 100, pieceSelections: [{ productId: "prod-1", size: "M" }] }],
        },
      ],
    };
    const issues = checkInventory(cart, [], SET_A_META, { "prod-1::M": 5 });
    expect(issues).toEqual([]);
  });
});

describe("checkInventory — modo BLOCK", () => {
  it("genera un issue BLOCK cuando la demanda excede el stock (MATRIX)", () => {
    const cart: CorporateCart = {
      items: [
        {
          setId: "set-a",
          setName: "Set A",
          sizeMode: "MATRIX",
          lines: [{ quantity: 40, pieceSelections: [{ productId: "prod-1", size: "M" }] }],
        },
      ],
    };
    const rules = [rule({ ruleType: "INVENTORY_MODE", scope: "GLOBAL", config: { mode: "BLOCK" } })];
    const issues = checkInventory(cart, rules, SET_A_META, { "prod-1::M": 25 });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      severity: "BLOCK",
      productId: "prod-1",
      size: "M",
      demand: 40,
      groupDemand: 40,
      available: 25,
    });
    expect(issues[0].message).toContain("40");
    expect(issues[0].message).toContain("25");
  });

  it("no genera issue cuando la demanda es igual al stock disponible (límite exacto)", () => {
    const cart: CorporateCart = {
      items: [
        {
          setId: "set-a",
          setName: "Set A",
          sizeMode: "MATRIX",
          lines: [{ quantity: 25, pieceSelections: [{ productId: "prod-1", size: "M" }] }],
        },
      ],
    };
    const rules = [rule({ config: { mode: "BLOCK" } })];
    const issues = checkInventory(cart, rules, SET_A_META, { "prod-1::M": 25 });
    expect(issues).toEqual([]);
  });

  it("trata un producto/talla ausente del snapshot como stock 0", () => {
    const cart: CorporateCart = {
      items: [
        {
          setId: "set-a",
          setName: "Set A",
          sizeMode: "MATRIX",
          lines: [{ quantity: 1, pieceSelections: [{ productId: "prod-1", size: "M" }] }],
        },
      ],
    };
    const rules = [rule({ config: { mode: "BLOCK" } })];
    const issues = checkInventory(cart, rules, SET_A_META, {});
    expect(issues).toHaveLength(1);
    expect(issues[0].available).toBe(0);
  });
});

describe("checkInventory — modo INFORMATIVE", () => {
  it("genera un issue INFORMATIVE (no BLOCK) cuando la demanda excede el stock", () => {
    const cart: CorporateCart = {
      items: [
        {
          setId: "set-a",
          setName: "Set A",
          sizeMode: "MATRIX",
          lines: [{ quantity: 40, pieceSelections: [{ productId: "prod-1", size: "M" }] }],
        },
      ],
    };
    const rules = [rule({ config: { mode: "INFORMATIVE" } })];
    const issues = checkInventory(cart, rules, SET_A_META, { "prod-1::M": 25 });
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("INFORMATIVE");
  });
});

describe("checkInventory — SIZE_MODE: PER_PIECE", () => {
  it("agrupa la demanda por producto+talla de cada pieza seleccionada", () => {
    const meta: Record<string, SetMeta> = {
      "set-b": {
        pieces: [
          { productId: "prod-1", productName: "Camisa", quantityPerSet: 1 },
          { productId: "prod-2", productName: "Pantalón", quantityPerSet: 1 },
        ],
      },
    };
    const cart: CorporateCart = {
      items: [
        {
          setId: "set-b",
          setName: "Set B",
          sizeMode: "PER_PIECE",
          lines: [
            {
              quantity: 30,
              pieceSelections: [
                { productId: "prod-1", size: "M" },
                { productId: "prod-2", size: "L" },
              ],
            },
          ],
        },
      ],
    };
    const rules = [rule({ config: { mode: "BLOCK" } })];
    const issues = checkInventory(cart, rules, meta, { "prod-1::M": 10, "prod-2::L": 100 });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ productId: "prod-1", size: "M", demand: 30, available: 10 });
  });
});

describe("checkInventory — SIZE_MODE: NO_SIZES", () => {
  it("agrupa la demanda solo por producto (clave sin talla)", () => {
    const meta: Record<string, SetMeta> = {
      "set-c": { pieces: [{ productId: "prod-9", productName: "Kit", quantityPerSet: 2 }] },
    };
    const cart: CorporateCart = {
      items: [
        {
          setId: "set-c",
          setName: "Set C",
          sizeMode: "NO_SIZES",
          lines: [{ quantity: 10, pieceSelections: [{ productId: "prod-9" }] }],
        },
      ],
    };
    const rules = [rule({ config: { mode: "BLOCK" } })];
    // 10 sets x 2 piezas/set = 20 unidades demandadas del producto 9
    const issues = checkInventory(cart, rules, meta, { "prod-9": 15 });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ productId: "prod-9", size: null, demand: 20, available: 15 });
  });
});

describe("checkInventory — demanda con color (armador de combinaciones)", () => {
  it("compara contra el stock exacto de talla+color cuando la pieza tiene color elegido", () => {
    const meta: Record<string, SetMeta> = {
      "set-d": { pieces: [{ productId: "prod-1", productName: "Camisa", quantityPerSet: 1 }] },
    };
    const cart: CorporateCart = {
      items: [
        {
          setId: "set-d",
          setName: "Set D",
          sizeMode: "PER_PIECE",
          lines: [{ quantity: 12, pieceSelections: [{ productId: "prod-1", size: "M", color: "PINK" }] }],
        },
      ],
    };
    const rules = [rule({ config: { mode: "BLOCK" } })];
    // Stock de M/PINK insuficiente aunque el total de la talla M (entre colores) alcance.
    const issues = checkInventory(cart, rules, meta, { "prod-1::M::PINK": 5, "prod-1::M": 40 });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ productId: "prod-1", size: "M", demand: 12, available: 5 });
  });

  it("dos combinaciones con la misma talla+color exacta suman su demanda", () => {
    const meta: Record<string, SetMeta> = {
      "set-d": { pieces: [{ productId: "prod-1", productName: "Camisa", quantityPerSet: 1 }] },
    };
    const cart: CorporateCart = {
      items: [
        {
          setId: "set-d",
          setName: "Set D",
          sizeMode: "PER_PIECE",
          lines: [
            { quantity: 10, pieceSelections: [{ productId: "prod-1", size: "M", color: "PINK" }] },
            { quantity: 10, pieceSelections: [{ productId: "prod-1", size: "M", color: "PINK" }] },
          ],
        },
      ],
    };
    const rules = [rule({ config: { mode: "BLOCK" } })];
    const issues = checkInventory(cart, rules, meta, { "prod-1::M::PINK": 15 });
    expect(issues).toHaveLength(1);
    expect(issues[0].groupDemand).toBe(20);
  });
});
