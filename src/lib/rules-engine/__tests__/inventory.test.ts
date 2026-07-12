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
      items: [{ setId: "set-a", setName: "Set A", sizeMode: "MATRIX", lines: [{ size: "M", quantity: 100 }] }],
    };
    const issues = checkInventory(cart, [], SET_A_META, { "prod-1::M": 5 });
    expect(issues).toEqual([]);
  });
});

describe("checkInventory — modo BLOCK", () => {
  it("genera un issue BLOCK cuando la demanda excede el stock (MATRIX)", () => {
    const cart: CorporateCart = {
      items: [{ setId: "set-a", setName: "Set A", sizeMode: "MATRIX", lines: [{ size: "M", quantity: 40 }] }],
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
      items: [{ setId: "set-a", setName: "Set A", sizeMode: "MATRIX", lines: [{ size: "M", quantity: 25 }] }],
    };
    const rules = [rule({ config: { mode: "BLOCK" } })];
    const issues = checkInventory(cart, rules, SET_A_META, { "prod-1::M": 25 });
    expect(issues).toEqual([]);
  });

  it("trata un producto/talla ausente del snapshot como stock 0", () => {
    const cart: CorporateCart = {
      items: [{ setId: "set-a", setName: "Set A", sizeMode: "MATRIX", lines: [{ size: "M", quantity: 1 }] }],
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
      items: [{ setId: "set-a", setName: "Set A", sizeMode: "MATRIX", lines: [{ size: "M", quantity: 40 }] }],
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
      items: [{ setId: "set-c", setName: "Set C", sizeMode: "NO_SIZES", lines: [{ quantity: 10 }] }],
    };
    const rules = [rule({ config: { mode: "BLOCK" } })];
    // 10 sets x 2 piezas/set = 20 unidades demandadas del producto 9
    const issues = checkInventory(cart, rules, meta, { "prod-9": 15 });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ productId: "prod-9", size: null, demand: 20, available: 15 });
  });
});

describe("checkInventory — agregación de demanda entre líneas y sets", () => {
  it("suma la demanda de dos sets distintos que comparten el mismo producto/talla", () => {
    const meta: Record<string, SetMeta> = {
      "set-a": { pieces: [{ productId: "prod-1", productName: "Camisa", quantityPerSet: 1 }] },
      "set-d": { pieces: [{ productId: "prod-1", productName: "Camisa", quantityPerSet: 1 }] },
    };
    const cart: CorporateCart = {
      items: [
        { setId: "set-a", setName: "Set A", sizeMode: "MATRIX", lines: [{ size: "M", quantity: 15 }] },
        { setId: "set-d", setName: "Set D", sizeMode: "MATRIX", lines: [{ size: "M", quantity: 15 }] },
      ],
    };
    const rules = [rule({ config: { mode: "BLOCK" } })];
    const issues = checkInventory(cart, rules, meta, { "prod-1::M": 20 });
    // 15 + 15 = 30 demandadas contra 20 disponibles -> ambos sets generan issue con el mismo groupDemand
    expect(issues).toHaveLength(2);
    expect(issues.every((i) => i.groupDemand === 30 && i.available === 20)).toBe(true);
    expect(issues.map((i) => i.demand).sort()).toEqual([15, 15]);
  });

  it("excluye del grupo a los ítems cuyo modo efectivo es IGNORE", () => {
    const meta: Record<string, SetMeta> = {
      "set-a": { pieces: [{ productId: "prod-1", quantityPerSet: 1 }] },
      "set-ignored": { pieces: [{ productId: "prod-1", quantityPerSet: 1 }] },
    };
    const cart: CorporateCart = {
      items: [
        { setId: "set-a", setName: "Set A", sizeMode: "MATRIX", lines: [{ size: "M", quantity: 30 }] },
        { setId: "set-ignored", setName: "Set Ignorado", sizeMode: "MATRIX", lines: [{ size: "M", quantity: 1000 }] },
      ],
    };
    const rules = [
      rule({ ruleType: "INVENTORY_MODE", scope: "GLOBAL", config: { mode: "BLOCK" } }),
      rule({ id: "r-ignore", ruleType: "INVENTORY_MODE", scope: "SET", scopeId: "set-ignored", priority: 1, config: { mode: "IGNORE" } }),
    ];
    const issues = checkInventory(cart, rules, meta, { "prod-1::M": 20 });
    // set-ignored no participa: solo set-a genera issue, y groupDemand no incluye las 1000 unidades ignoradas.
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ setId: "set-a", demand: 30, groupDemand: 30 });
  });

  it("cuando BLOCK e INFORMATIVE comparten el mismo grupo excedido, cada uno recibe su propia severidad", () => {
    const meta: Record<string, SetMeta> = {
      "set-block": { setGroupId: null, brandId: null, pieces: [{ productId: "prod-1", quantityPerSet: 1 }] },
      "set-info": { setGroupId: null, brandId: "brand-x", pieces: [{ productId: "prod-1", quantityPerSet: 1 }] },
    };
    const cart: CorporateCart = {
      items: [
        { setId: "set-block", setName: "Set Block", sizeMode: "MATRIX", lines: [{ size: "M", quantity: 15 }] },
        { setId: "set-info", setName: "Set Info", sizeMode: "MATRIX", lines: [{ size: "M", quantity: 15 }] },
      ],
    };
    const rules = [
      rule({ id: "r-global", ruleType: "INVENTORY_MODE", scope: "GLOBAL", config: { mode: "BLOCK" } }),
      rule({ id: "r-brand", ruleType: "INVENTORY_MODE", scope: "BRAND", scopeId: "brand-x", config: { mode: "INFORMATIVE" } }),
    ];
    const issues = checkInventory(cart, rules, meta, { "prod-1::M": 20 });
    expect(issues).toHaveLength(2);
    const blockIssue = issues.find((i) => i.setId === "set-block");
    const infoIssue = issues.find((i) => i.setId === "set-info");
    expect(blockIssue?.severity).toBe("BLOCK");
    expect(infoIssue?.severity).toBe("INFORMATIVE");
    expect(blockIssue?.groupDemand).toBe(30);
    expect(infoIssue?.groupDemand).toBe(30);
  });
});

describe("checkInventory — resolución por ámbito", () => {
  it("una regla SET con BLOCK gana sobre GLOBAL en IGNORE para ese set", () => {
    const cart: CorporateCart = {
      items: [{ setId: "set-a", setName: "Set A", sizeMode: "MATRIX", lines: [{ size: "M", quantity: 40 }] }],
    };
    const rules = [
      rule({ id: "r-global", ruleType: "INVENTORY_MODE", scope: "GLOBAL", config: { mode: "IGNORE" } }),
      rule({ id: "r-set", ruleType: "INVENTORY_MODE", scope: "SET", scopeId: "set-a", config: { mode: "BLOCK" } }),
    ];
    const issues = checkInventory(cart, rules, SET_A_META, { "prod-1::M": 25 });
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("BLOCK");
  });

  it("una regla GLOBAL en BLOCK aplica cuando no existe regla SET para ese set", () => {
    const cart: CorporateCart = {
      items: [{ setId: "set-a", setName: "Set A", sizeMode: "MATRIX", lines: [{ size: "M", quantity: 40 }] }],
    };
    const rules = [rule({ id: "r-global", ruleType: "INVENTORY_MODE", scope: "GLOBAL", config: { mode: "BLOCK" } })];
    const issues = checkInventory(cart, rules, SET_A_META, { "prod-1::M": 25 });
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("BLOCK");
  });
});
