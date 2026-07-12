import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminSetById, getAdminRules } from '@/lib/admin-data-service';
import { resolveBestRule, type BusinessRule, type RuleType } from '@/lib/rules-engine';

const ALL_RULE_TYPES: RuleType[] = [
  'MIN_QUANTITY',
  'MULTIPLES_ONLY',
  'QUANTITY_RANGE',
  'SIZE_MODE',
  'PRICE_VISIBILITY',
  'INVENTORY_MODE',
  'VOLUME_SCALE',
  'PROMO',
  'COLOR_RESTRICTION',
  'VOLUME_DISCOUNT_RETAIL',
];

/**
 * GET /api/admin/sets/[id]/rules
 * Reglas que afectan a este set: ámbito SET (scopeId = set), más las heredadas de GLOBAL,
 * BRAND, SET_GROUP y PRODUCT (piezas del set). Anota, por tipo de regla, cuál gana la
 * resolución — reutiliza `resolveBestRule` (la misma función de producción), no la reimplementa.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const set = await getAdminSetById(id);
    if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const productIds = set.items.map((i) => i.productId).filter((pid): pid is string => !!pid);
    const context = { setId: set.id, setGroupId: set.setGroupId, brandId: set.brandId, productIds };

    const allRulesRaw = await getAdminRules();
    const allRules: BusinessRule[] = allRulesRaw.map((r) => ({
      id: r.id,
      name: r.name,
      ruleType: r.ruleType as BusinessRule['ruleType'],
      scope: r.scope as BusinessRule['scope'],
      scopeId: r.scopeId,
      config: r.config as Record<string, unknown>,
      isActive: r.isActive ?? true,
      priority: r.priority ?? 0,
      validFrom: r.validFrom,
      validTo: r.validTo,
    }));

    // Reglas relevantes: SET de este set, GLOBAL, BRAND/SET_GROUP de este set, o PRODUCT de
    // alguna de sus piezas — el resto del catálogo no aparece (no son "heredadas" de este set).
    const relevant = allRules.filter((r) => {
      if (r.scope === 'GLOBAL') return true;
      if (r.scope === 'SET') return r.scopeId === set.id;
      if (r.scope === 'BRAND') return !!set.brandId && r.scopeId === set.brandId;
      if (r.scope === 'SET_GROUP') return !!set.setGroupId && r.scopeId === set.setGroupId;
      if (r.scope === 'PRODUCT') return !!r.scopeId && productIds.includes(r.scopeId);
      return false;
    });

    const now = new Date();
    const winnerIdByType = new Map<RuleType, string | undefined>();
    for (const ruleType of ALL_RULE_TYPES) {
      const winner = resolveBestRule(allRules, ruleType, context, now);
      winnerIdByType.set(ruleType, winner?.id);
    }

    const rules = relevant.map((r) => ({
      ...r,
      isWinner: winnerIdByType.get(r.ruleType as RuleType) === r.id,
    }));

    return NextResponse.json({ rules });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
