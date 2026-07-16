import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock de @/db ───
// El servicio usa la API relacional de Drizzle (`db.query.<tabla>.findFirst/findMany`)
// para cargar en una sola llamada las relaciones ya resueltas de una variante, y
// `db.update(...).set(...).where(...)` para persistir el payload. Mockeamos cada
// función de consulta por separado (control total por test) y capturamos los
// `set()` de update para inspeccionar el payload calculado.

const findFirstVariant = vi.fn();
const findManyVariantsByProduct = vi.fn();
const findManyLinksByAttributeValue = vi.fn();
const findManyProducts = vi.fn();
const updateSetCalls: Array<{ variantId: string; data: unknown }> = [];

function makeUpdateChain() {
  let pendingData: unknown;
  const chain = {
    set(data: unknown) {
      pendingData = data;
      return chain;
    },
    where(condition: { variantId?: string } | unknown) {
      // Los tests solo necesitan saber "qué se guardó"; el variantId real lo
      // capturamos vía el mock del eq() usado en el where (ver abajo).
      updateSetCalls.push({ variantId: String(condition), data: pendingData });
      return Promise.resolve();
    },
  };
  return chain;
}

vi.mock("@/db", () => ({
  db: {
    query: {
      productVariants: {
        findFirst: (...args: unknown[]) => findFirstVariant(...args),
        findMany: (...args: unknown[]) => findManyVariantsByProduct(...args),
      },
      variantAttributeValues: {
        findMany: (...args: unknown[]) => findManyLinksByAttributeValue(...args),
      },
      products: {
        findMany: (...args: unknown[]) => findManyProducts(...args),
      },
    },
    update: () => makeUpdateChain(),
  },
}));

import {
  syncVariantAttributesPayload,
  recalculateVariantPayloadsForProduct,
  recalculateVariantPayloadsForAttributeValue,
  AttributesPayloadSyncError,
} from "../service";

function variantFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "variant-1",
    size: "M",
    product: {
      code: "2624A",
      gender: "MUJER",
      brand: { name: "Cherokee" },
      collection: { name: "Infinity" },
      productType: { name: "Scrub Pants" },
    },
    color: { code: "NVY" },
    attributeValues: [
      { attributeValue: { value: "Petite", attribute: { slug: "corte_pantalon" } } },
      { attributeValue: { value: "Cargo", attribute: { slug: "tipo_bolsillo" } } },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateSetCalls.length = 0;
});

describe("syncVariantAttributesPayload", () => {
  it("carga las relaciones de la variante y persiste el payload calculado", async () => {
    findFirstVariant.mockResolvedValue(variantFixture());

    await syncVariantAttributesPayload("variant-1");

    expect(findFirstVariant).toHaveBeenCalledTimes(1);
    expect(updateSetCalls).toHaveLength(1);
    expect(updateSetCalls[0].data).toEqual({
      attributesPayload: {
        brand: "Cherokee",
        collection: "Infinity",
        product_type: "Scrub Pants",
        code: "2624A",
        styles: { corte_pantalon: "Petite", tipo_bolsillo: "Cargo" },
        color_code: "NVY",
        size: "M",
        gender: "MUJER",
      },
    });
  });

  it("omite collection/product_type cuando el producto no los tiene", async () => {
    findFirstVariant.mockResolvedValue(
      variantFixture({
        product: {
          code: "2624A",
          gender: "MUJER",
          brand: { name: "Cherokee" },
          collection: null,
          productType: null,
        },
      })
    );

    await syncVariantAttributesPayload("variant-1");

    const payload = updateSetCalls[0].data as { attributesPayload: Record<string, unknown> };
    expect(payload.attributesPayload).not.toHaveProperty("collection");
    expect(payload.attributesPayload).not.toHaveProperty("product_type");
  });

  it("arma styles: {} cuando la variante no tiene atributos asociados", async () => {
    findFirstVariant.mockResolvedValue(variantFixture({ attributeValues: [] }));

    await syncVariantAttributesPayload("variant-1");

    const payload = updateSetCalls[0].data as { attributesPayload: { styles: Record<string, unknown> } };
    expect(payload.attributesPayload.styles).toEqual({});
  });

  it("lanza AttributesPayloadSyncError si la variante no existe", async () => {
    findFirstVariant.mockResolvedValue(undefined);

    await expect(syncVariantAttributesPayload("no-existe")).rejects.toBeInstanceOf(AttributesPayloadSyncError);
  });
});

describe("recalculateVariantPayloadsForProduct — recálculo en cascada", () => {
  it("recalcula el payload de todas las variantes del producto reflejando un rename de collection", async () => {
    findManyVariantsByProduct.mockResolvedValue([{ id: "variant-1" }, { id: "variant-2" }]);
    findFirstVariant.mockImplementation(async () =>
      variantFixture({ product: { code: "2624A", gender: "MUJER", brand: { name: "Cherokee" }, collection: { name: "Infinity Renombrada" }, productType: { name: "Scrub Pants" } } })
    );

    await recalculateVariantPayloadsForProduct("product-1");

    expect(findManyVariantsByProduct).toHaveBeenCalledTimes(1);
    expect(updateSetCalls).toHaveLength(2);
    for (const call of updateSetCalls) {
      const payload = call.data as { attributesPayload: { collection: string } };
      expect(payload.attributesPayload.collection).toBe("Infinity Renombrada");
    }
  });
});

describe("recalculateVariantPayloadsForAttributeValue — recálculo en cascada", () => {
  it("recalcula solo las variantes que tienen asignado el attributeValue renombrado", async () => {
    findManyLinksByAttributeValue.mockResolvedValue([{ variantId: "variant-1" }]);
    findFirstVariant.mockResolvedValue(
      variantFixture({
        attributeValues: [{ attributeValue: { value: "Petite (P)", attribute: { slug: "corte_pantalon" } } }],
      })
    );

    await recalculateVariantPayloadsForAttributeValue("attr-value-1");

    expect(findManyLinksByAttributeValue).toHaveBeenCalledTimes(1);
    expect(updateSetCalls).toHaveLength(1);
    const payload = updateSetCalls[0].data as { attributesPayload: { styles: Record<string, string> } };
    expect(payload.attributesPayload.styles.corte_pantalon).toBe("Petite (P)");
  });
});
