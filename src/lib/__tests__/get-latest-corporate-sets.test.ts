import { describe, it, expect } from "vitest";
import type { CorporateSetNavItem } from "../corporate-types";

describe("CorporateSetNavItem shape", () => {
  it("accepts a minimal valid nav item", () => {
    const item: CorporateSetNavItem = {
      id: "set-1",
      slug: "set-uno",
      name: "Set Uno",
      cover: null,
      secondaryCover: null,
      brandName: null,
      referencePrice: null,
      colors: [],
      pairedColors: [],
      coversByColor: [],
      collections: [],
      productTypes: [],
      availableStyles: {},
      pieceCodes: [],
    };
    expect(item.id).toBe("set-1");
  });

  it("accepts a fully populated nav item with a numeric price", () => {
    const item: CorporateSetNavItem = {
      id: "set-2",
      slug: "set-dos",
      name: "Set Dos",
      cover: {
        type: "image",
        url: "https://example.com/a.jpg",
        mimeType: "image/jpeg",
        width: 800,
        height: 600,
      },
      secondaryCover: null,
      brandName: "AllMedic",
      referencePrice: 42.5,
      colors: [{ id: "c-wne", code: "WNE", name: "Wine", hex: "#7B1E3A", kind: "SOLID", swatchUrl: null }],
      pairedColors: [{ id: "c-wne", code: "WNE", name: "Wine", hex: "#7B1E3A", kind: "SOLID", swatchUrl: null }],
      coversByColor: [],
      collections: ["Temporada Clínica"],
      productTypes: ["Camisas"],
      availableStyles: { corte: ["Regular"] },
      pieceCodes: ["2624A"],
    };
    expect(item.referencePrice).toBe(42.5);
  });
});
