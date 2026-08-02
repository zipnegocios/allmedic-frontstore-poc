import { describe, it, expect } from "vitest";
import type { CorporateSetNavItem } from "../corporate-types";

describe("CorporateSetNavItem shape", () => {
  it("accepts a minimal valid nav item", () => {
    const item: CorporateSetNavItem = {
      id: "set-1",
      slug: "set-uno",
      name: "Set Uno",
      cover: null,
      brandName: null,
      referencePrice: null,
      colors: [],
      collections: [],
      productTypes: [],
      availableStyles: {},
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
      brandName: "AllMedic",
      referencePrice: 42.5,
      colors: [{ code: "WNE", name: "Wine" }],
      collections: ["Temporada Clínica"],
      productTypes: ["Camisas"],
      availableStyles: { corte: ["Regular"] },
    };
    expect(item.referencePrice).toBe(42.5);
  });
});
