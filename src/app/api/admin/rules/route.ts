import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminRules, createRule } from '@/lib/admin-data-service';
import { validateRuleConfig, RULE_CONFIG_SCHEMAS } from '@/lib/rule-config-schemas';

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
    return NextResponse.json({ rules });
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
