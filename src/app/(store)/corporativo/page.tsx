import { getActiveCorporateSets, getAllBusinessRules } from '@/lib/corporate-data-service';
import { resolveRules } from '@/lib/rules-engine';
import { CorporativoContent } from './CorporativoContent';

// Precios y reglas son datos en vivo — nunca pre-renderizar en build-time
// (evita fallos de build cuando DATABASE_URL solo está disponible en runtime, ej. Docker/EasyPanel).
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Catálogo Corporativo | AllMedic Uniforms',
  description: 'Sets de uniformes médicos para instituciones y compras al mayor.',
};

export default async function CorporativoPage() {
  const [sets, rules] = await Promise.all([
    getActiveCorporateSets(),
    getAllBusinessRules(),
  ]);

  const resolved = resolveRules(rules, {});

  // Visibilidad de precios resuelta POR SET en el cliente (loop en memoria, no N consultas) — así
  // una regla PRICE_VISIBILITY de ámbito Marca/Set/Producto oculta el precio en la tarjeta
  // del grid, no solo en la ficha de detalle. Se envían solo las reglas de este tipo al cliente.
  const priceVisibilityRules = rules.filter((r) => r.ruleType === 'PRICE_VISIBILITY');

  return (
    <CorporativoContent
      sets={sets}
      priceVisibilityRules={priceVisibilityRules}
      minQuantity={resolved.minQuantity.min}
    />
  );
}
