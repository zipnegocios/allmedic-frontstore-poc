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

  const resolved = resolveRules(rules, {
    setId: set.id,
    setGroupId: set.setGroupId,
    brandId: set.brandId,
  });

  const showPrices =
    resolved.priceVisibility.showPrices &&
    (resolved.priceVisibility.catalog === 'CORPORATE' || resolved.priceVisibility.catalog === 'BOTH');

  const inventoryMode = resolved.inventoryMode.mode;
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
    />
  );
}
