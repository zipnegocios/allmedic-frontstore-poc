// ─── Validación de inventario (INVENTORY_MODE) ───
// Módulo puro y testeable — sin dependencias de base de datos ni de Next.js.
// El snapshot de stock se recibe ya calculado (inyectado por la capa de datos);
// esta función solo compara demanda contra disponibilidad y arma los mensajes.

import type {
  BusinessRule,
  CorporateCart,
  InventoryIssue,
  InventoryStockSnapshot,
  SetMeta,
  SetPieceInfo,
} from "./types";
import { resolveRules } from "./resolve";

function pluralUnidades(n: number): string {
  return n === 1 ? "unidad" : "unidades";
}

function pluralDisponibles(n: number): string {
  return n === 1 ? "disponible" : "disponibles";
}

/** Clave del snapshot: `productId::size::color` cuando la pieza tiene color elegido,
 * `productId::size` con talla sin color, o solo `productId` sin talla (NO_SIZES, donde el
 * color no participa en el control de inventario — solo talla+color agotan variantes reales). */
function stockKey(productId: string, size: string | null, color: string | null): string {
  if (size && color) return `${productId}::${size}::${color}`;
  if (size) return `${productId}::${size}`;
  return productId;
}

interface DemandEntry {
  setId: string;
  setName?: string;
  mode: "BLOCK" | "INFORMATIVE";
  key: string;
  productId: string;
  productName?: string;
  size: string | null;
  demand: number;
}

/** Demanda de UN ítem del carrito (un set), agrupada por clave de stock. No agrega entre ítems.
 * El armador de combinaciones siempre puebla `pieceSelections` (una entrada por pieza,
 * con o sin talla/color según `SIZE_MODE`) — no hay ramas distintas por modo aquí. */
function computeItemDemand(
  item: CorporateCart["items"][number],
  pieces: SetPieceInfo[],
  mode: "BLOCK" | "INFORMATIVE"
): DemandEntry[] {
  const byKey = new Map<string, DemandEntry>();

  function addDemand(productId: string, productName: string | undefined, size: string | null, color: string | null, qty: number) {
    if (qty <= 0) return;
    const key = stockKey(productId, size, color);
    const existing = byKey.get(key);
    if (existing) {
      existing.demand += qty;
    } else {
      byKey.set(key, {
        setId: item.setId,
        setName: item.setName,
        mode,
        key,
        productId,
        productName,
        size,
        demand: qty,
      });
    }
  }

  for (const line of item.lines) {
    for (const sel of line.pieceSelections ?? []) {
      const piece = pieces.find((p) => p.productId === sel.productId);
      const qtyPerSet = piece?.quantityPerSet ?? 1;
      addDemand(sel.productId, piece?.productName, sel.size ?? null, sel.color ?? null, line.quantity * qtyPerSet);
    }
  }

  return Array.from(byKey.values());
}

/**
 * Verifica la demanda del carrito corporativo contra un snapshot de stock ya calculado.
 * Resuelve INVENTORY_MODE por ítem (mismo patrón que PROMO en pricing.ts). Los ítems cuyo
 * modo efectivo es IGNORE no participan ni generan demanda ni cuentan en la suma agregada
 * de otros ítems que compartan el mismo producto/talla.
 */
export function checkInventory(
  cart: CorporateCart,
  allRules: BusinessRule[],
  setMeta: Record<string, SetMeta>,
  stockSnapshot: InventoryStockSnapshot,
  now: Date = new Date()
): InventoryIssue[] {
  const allEntries: DemandEntry[] = [];

  for (const item of cart.items) {
    const meta = setMeta[item.setId] ?? {};
    const resolved = resolveRules(
      allRules,
      { setId: item.setId, setGroupId: meta.setGroupId, brandId: meta.brandId },
      now
    );
    const mode = resolved.inventoryMode.mode;
    if (mode === "IGNORE") continue;

    const pieces = meta.pieces ?? [];
    allEntries.push(...computeItemDemand(item, pieces, mode));
  }

  // Demanda agregada por clave de stock, sumando entre todos los ítems participantes.
  const groupTotals = new Map<string, number>();
  for (const entry of allEntries) {
    groupTotals.set(entry.key, (groupTotals.get(entry.key) ?? 0) + entry.demand);
  }

  const issues: InventoryIssue[] = [];
  for (const entry of allEntries) {
    const groupDemand = groupTotals.get(entry.key) ?? entry.demand;
    // Snapshot sin entrada para un producto/talla se trata como stock 0 (nunca bloquea de menos).
    const available = stockSnapshot[entry.key] ?? 0;
    if (groupDemand <= available) continue;

    const productLabel = entry.productName ?? entry.productId;
    const sizeLabel = entry.size ? ` talla ${entry.size}` : "";

    const message =
      entry.mode === "BLOCK"
        ? `Stock insuficiente: pediste ${groupDemand} ${pluralUnidades(groupDemand)} de "${productLabel}"${sizeLabel} y hay ${available} ${pluralDisponibles(available)}.`
        : `Aviso de stock: pediste ${groupDemand} ${pluralUnidades(groupDemand)} de "${productLabel}"${sizeLabel} y hay ${available} ${pluralDisponibles(available)}. Se registra para el equipo de ventas — la solicitud se puede enviar igual.`;

    issues.push({
      severity: entry.mode,
      code: "INVENTORY_INSUFFICIENT",
      setId: entry.setId,
      setName: entry.setName,
      productId: entry.productId,
      productName: entry.productName,
      size: entry.size,
      demand: entry.demand,
      groupDemand,
      available,
      message,
    });
  }

  return issues;
}
