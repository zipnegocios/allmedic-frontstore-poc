import { describe, it, expect } from "vitest";
import { buildAttributesPayload } from "../build-payload";

describe("buildAttributesPayload — construcción básica", () => {
  it("arma el payload con todos los campos presentes", () => {
    const payload = buildAttributesPayload({
      brandName: "Cherokee",
      collectionName: "Infinity",
      productTypeName: "Scrub Pants",
      code: "2624A",
      colorCode: "NVY",
      size: "M",
      gender: "MUJER",
      styles: [
        { attributeSlug: "corte_pantalon", value: "Petite" },
        { attributeSlug: "tipo_bolsillo", value: "Cargo" },
      ],
    });

    expect(payload).toEqual({
      brand: "Cherokee",
      collection: "Infinity",
      product_type: "Scrub Pants",
      code: "2624A",
      styles: { corte_pantalon: "Petite", tipo_bolsillo: "Cargo" },
      color_code: "NVY",
      size: "M",
      gender: "MUJER",
    });
  });
});

describe("buildAttributesPayload — collection/product_type ausentes", () => {
  it("omite la clave `collection` cuando collectionName es null", () => {
    const payload = buildAttributesPayload({
      brandName: "Cherokee",
      collectionName: null,
      productTypeName: "Scrub Pants",
      code: "2624A",
      colorCode: "NVY",
      size: "M",
      gender: "MUJER",
      styles: [],
    });

    expect(payload).not.toHaveProperty("collection");
    expect(payload.product_type).toBe("Scrub Pants");
  });

  it("omite la clave `product_type` cuando productTypeName es null", () => {
    const payload = buildAttributesPayload({
      brandName: "Cherokee",
      collectionName: "Infinity",
      productTypeName: null,
      code: "2624A",
      colorCode: "NVY",
      size: "M",
      gender: "MUJER",
      styles: [],
    });

    expect(payload).not.toHaveProperty("product_type");
    expect(payload.collection).toBe("Infinity");
  });

  it("omite ambas claves cuando collectionName y productTypeName son undefined", () => {
    const payload = buildAttributesPayload({
      brandName: "Cherokee",
      code: "2624A",
      colorCode: "NVY",
      size: "M",
      gender: "MUJER",
      styles: [],
    });

    expect(payload).not.toHaveProperty("collection");
    expect(payload).not.toHaveProperty("product_type");
  });
});

describe("buildAttributesPayload — variante sin atributos", () => {
  it("styles es un objeto vacío, no ausente", () => {
    const payload = buildAttributesPayload({
      brandName: "Cherokee",
      collectionName: "Infinity",
      productTypeName: "Scrub Pants",
      code: "2624A",
      colorCode: "NVY",
      size: "M",
      gender: "MUJER",
      styles: [],
    });

    expect(payload.styles).toEqual({});
  });
});

describe("buildAttributesPayload — estabilidad de claves (slug, no name)", () => {
  it("usa el slug del atributo como clave, no el nombre, evitando colisiones entre atributos con nombres parecidos", () => {
    const payload = buildAttributesPayload({
      brandName: "Cherokee",
      code: "2624A",
      colorCode: "NVY",
      size: "M",
      gender: "MUJER",
      styles: [
        { attributeSlug: "corte", value: "Petite" },
        { attributeSlug: "corte_pantalon", value: "Regular" },
      ],
    });

    expect(payload.styles).toEqual({
      corte: "Petite",
      corte_pantalon: "Regular",
    });
    expect(Object.keys(payload.styles)).toHaveLength(2);
  });
});
