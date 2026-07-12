import { notFound } from 'next/navigation';
import { getCorporateSetBySlug, getAllBusinessRules, getInventorySnapshotByProductIds } from '@/lib/corporate-data-service';
import { resolveRules } from '@/lib/rules-engine';
import { SetDetailContent } from './SetDetailContent';

// Precios y reglas son datos en vivo — nunca pre-renderizar en build-time.
export const dynamic = 'force-dynamic';

interface SetDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function SetDetailPage({ params }: SetDetailPageProps) {
  const { slug } = await params;
  const [set, rules] = await Promise.all([getCorporateSetBySlug(slug), getAllBusinessRules()]);

  if (!set) {
    notFound();
  }

  const productIds = set.pieces.map((p) => p.productId);
  const resolved = resolveRules(rules, {
    setId: set.id,
    setGroupId: set.setGroupId,
    brandId: set.brandId,
    productIds,
  });

  const showPrices =
    resolved.priceVisibility.showPrices &&
    (resolved.priceVisibility.catalog === 'CORPORATE' || resolved.priceVisibility.catalog === 'BOTH');

  // INVENTORY_MODE se resuelve aparte, SIN productIds: su verificación real en servidor
  // (checkInventory, POST /api/corporate/quotes) no considera ámbito Producto, así que aquí
  // tampoco — evita que la ficha muestre disponibilidad basada en una regla que el servidor
  // nunca aplicaría al bloquear el envío.
  const inventoryMode = resolveRules(rules, {
    setId: set.id,
    setGroupId: set.setGroupId,
    brandId: set.brandId,
  }).inventoryMode.mode;
  const stockSnapshot =
    inventoryMode !== 'IGNORE'
      ? await getInventorySnapshotByProductIds(set.pieces.map((p) => p.productId))
      : {};

  return (
    <SetDetailContent
      set={set}
      sizeMode={resolved.sizeMode.mode}
      minQuantity={resolved.minQuantity.min}
      showPrices={showPrices}
      inventoryMode={inventoryMode}
      stockSnapshot={stockSnapshot}
      colorRestrictions={resolved.colorRestrictions}
    />
  );
}
