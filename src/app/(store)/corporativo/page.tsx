import { getActiveCorporateSets, getActiveSetGroups, getAllBusinessRules } from '@/lib/corporate-data-service';
import { resolveRules } from '@/lib/rules-engine';
import { CorporativoContent } from './CorporativoContent';

export const metadata = {
  title: 'Catálogo Corporativo | AllMedic Uniforms',
  description: 'Sets de uniformes médicos para instituciones y compras al mayor.',
};

export default async function CorporativoPage() {
  const [sets, groups, rules] = await Promise.all([
    getActiveCorporateSets(),
    getActiveSetGroups(),
    getAllBusinessRules(),
  ]);

  const resolved = resolveRules(rules, {});
  const showPrices = resolved.priceVisibility.showPrices &&
    (resolved.priceVisibility.catalog === 'CORPORATE' || resolved.priceVisibility.catalog === 'BOTH');

  return <CorporativoContent sets={sets} groups={groups} showPrices={showPrices} minQuantity={resolved.minQuantity.min} />;
}
