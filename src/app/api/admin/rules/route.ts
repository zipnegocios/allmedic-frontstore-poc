import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminRules, createRule, checkComboSetsExist } from '@/lib/admin-data-service';
import { validateRuleConfig, RULE_CONFIG_SCHEMAS, toBusinessRule } from '@/lib/rule-config-schemas';
import { detectConflicts, type BusinessRule } from '@/lib/rules-engine';

const RULE_TYPES = Object.keys(RULE_CONFIG_SCHEMAS) as [string, ...string[]];

const CreateRuleSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  ruleType: z.enum(RULE_TYPES),
  scope: z.enum(['GLOBAL', 'BRAND', 'SET_GROUP', 'SET', 'PRODUCT']),
  scopeId: z.string().nullable(),
  config: z.unknown(),
  priority: z.number().int().optional(),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
}).refine((v) => v.scope === 'GLOBAL' || !!v.scopeId, {
  message: 'scopeId es requerido cuando el ámbito no es GLOBAL',
  path: ['scopeId'],
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const ruleType = searchParams.get('ruleType') ?? undefined;
    const scope = searchParams.get('scope') ?? undefined;
    const rules = await getAdminRules({ ruleType, scope });

    // Salud de reglas: una pasada en servidor, cada regla activa contra el resto.
    const allRules = await getAdminRules();
    const businessRules = allRules.map(toBusinessRule);
    const rulesWithHealth = rules.map((rule) => {
      if (!rule.isActive) return { ...rule, conflictErrors: 0, conflictWarnings: 0 };
      const conflicts = detectConflicts(toBusinessRule(rule), businessRules);
      return {
        ...rule,
        conflictErrors: conflicts.filter((c) => c.severity === 'ERROR').length,
        conflictWarnings: conflicts.filter((c) => c.severity === 'WARNING').length,
      };
    });

    return NextResponse.json({ rules: rulesWithHealth });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = CreateRuleSchema.parse(await request.json());
    const config = validateRuleConfig(body.ruleType, body.config);

    // Doble validación en servidor (regla de oro del proyecto): un ERROR de conflicto
    // se rechaza aunque el cliente se lo haya saltado.
    const existingRules = (await getAdminRules()).map(toBusinessRule);
    const candidate: BusinessRule = {
      id: '',
      name: body.name,
      ruleType: body.ruleType as BusinessRule['ruleType'],
      scope: body.scope,
      scopeId: body.scope === 'GLOBAL' ? null : body.scopeId,
      config,
      isActive: true,
      priority: body.priority ?? 0,
      validFrom: body.validFrom ? new Date(body.validFrom) : null,
      validTo: body.validTo ? new Date(body.validTo) : null,
    };
    const conflicts = detectConflicts(candidate, existingRules);
    if (candidate.ruleType === 'PROMO' && (candidate.config as { kind?: string }).kind === 'COMBO') {
      conflicts.push(...(await checkComboSetsExist(candidate)));
    }
    const errors = conflicts.filter((c) => c.severity === 'ERROR');
    if (errors.length > 0) {
      return NextResponse.json({ error: 'La regla tiene conflictos que impiden guardarla', conflicts: errors }, { status: 409 });
    }

    const rule = await createRule({
      name: body.name,
      ruleType: body.ruleType,
      scope: body.scope,
      scopeId: body.scope === 'GLOBAL' ? null : body.scopeId,
      config,
      priority: body.priority ?? 0,
      validFrom: body.validFrom ? new Date(body.validFrom) : null,
      validTo: body.validTo ? new Date(body.validTo) : null,
    });

    return NextResponse.json(rule, { status: 201 });
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
