import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminRules } from '@/lib/admin-data-service';
import { detectConflicts, type BusinessRule } from '@/lib/rules-engine';
import { RULE_CONFIG_SCHEMAS, toBusinessRule } from '@/lib/rule-config-schemas';

const RULE_TYPES = Object.keys(RULE_CONFIG_SCHEMAS) as [string, ...string[]];

const CandidateSchema = z.object({
  id: z.string().optional().default(''),
  name: z.string().optional().default(''),
  ruleType: z.enum(RULE_TYPES),
  scope: z.enum(['GLOBAL', 'BRAND', 'SET_GROUP', 'SET', 'PRODUCT']),
  scopeId: z.string().nullable(),
  config: z.unknown(),
  priority: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
});

/**
 * POST /api/admin/rules/check-conflicts
 * Dry-run: analiza una regla candidata (nueva o en edición) contra el resto de reglas
 * existentes y devuelve los conflictos detectados, sin persistir nada.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = CandidateSchema.parse(await request.json());

    const [allRules] = await Promise.all([getAdminRules()]);
    const candidate: BusinessRule = {
      id: body.id,
      name: body.name,
      ruleType: body.ruleType as BusinessRule['ruleType'],
      scope: body.scope,
      scopeId: body.scope === 'GLOBAL' ? null : body.scopeId,
      config: (body.config ?? {}) as Record<string, unknown>,
      isActive: body.isActive,
      priority: body.priority,
      validFrom: body.validFrom ?? null,
      validTo: body.validTo ?? null,
    };

    const conflicts = detectConflicts(candidate, allRules.map(toBusinessRule));
    return NextResponse.json({ conflicts });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Validation error', details: err.issues }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
