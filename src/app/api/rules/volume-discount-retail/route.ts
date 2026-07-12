import { NextResponse } from "next/server";
import { getAllBusinessRules } from "@/lib/corporate-data-service";
import { resolveRules } from "@/lib/rules-engine";

const FALLBACK_TIERS = [
  { minItems: 3, pct: 10 },
  { minItems: 5, pct: 15 },
  { minItems: 10, pct: 20 },
];

/**
 * GET /api/rules/volume-discount-retail
 * Devuelve los tiers de descuento por volumen del catálogo individual,
 * resueltos desde el motor de reglas (regla GLOBAL `VOLUME_DISCOUNT_RETAIL`).
 * Público y sin auth — es información de precios visible en el catálogo.
 */
export async function GET() {
  try {
    const rules = await getAllBusinessRules();
    const resolved = resolveRules(rules, {}, new Date());
    const tiers = resolved.volumeDiscountRetail?.tiers ?? FALLBACK_TIERS;
    return NextResponse.json({ tiers });
  } catch (err) {
    console.error("[api/rules/volume-discount-retail] Error:", err);
    return NextResponse.json({ tiers: FALLBACK_TIERS });
  }
}
