import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminRuleById, updateRule, deleteRule, getAdminRules, checkComboSetsExist } from '@/lib/admin-data-service';

import { validateRuleConfig, toBusinessRule } from '@/lib/rule-config-schemas';
import { detectConflicts, type BusinessRule } from '@/lib/rules-engine';

const PatchRuleSchema = z.object({
  name: z.string().min(1).optional(),
  scope: z.enum(['GLOBAL', 'BRAND', 'SET_GROUP', 'SET', 'PRODUCT']).optional(),
  scopeId: z.string().nullable().optional(),
  config: z.unknown().optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const rule = await getAdminRuleById(id);
    if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(rule);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = PatchRuleSchema.parse(await request.json());

    const existing = await getAdminRuleById(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (existing.ruleType === 'COLOR_PAIRING') {
      const triesToChangeManagedFields =
        (body.isActive !== undefined && body.isActive !== existing.isActive) ||
        (body.scope !== undefined && body.scope !== existing.scope) ||
        (body.scopeId !== undefined && body.scopeId !== existing.scopeId) ||
        body.config !== undefined;
      if (triesToChangeManagedFields) {
        return NextResponse.json(
          { error: 'Esta regla es gestionada por el sistema — no se puede activar, desactivar ni reconfigurar manualmente. Cambia el modo de color del set, o contacta al desarrollador.' },
          { status: 403 }
        );
      }
    }

    const config = body.config !== undefined
      ? validateRuleConfig(existing.ruleType, body.config)
      : undefined;

    // Doble validación en servidor: solo si la regla resultante queda activa —
    // desactivar una regla siempre debe permitirse, incluso para resolver un conflicto.
    const resultingIsActive = body.isActive ?? existing.isActive ?? true;
    if (resultingIsActive) {
      const candidate: BusinessRule = {
        id: existing.id,
        name: body.name ?? existing.name,
        ruleType: existing.ruleType as BusinessRule['ruleType'],
        scope: (body.scope ?? existing.scope) as BusinessRule['scope'],
        scopeId: body.scopeId !== undefined ? body.scopeId : existing.scopeId,
        config: (config ?? existing.config) as Record<string, unknown>,
        isActive: true,
        priority: body.priority ?? existing.priority ?? 0,
        validFrom: body.validFrom !== undefined ? (body.validFrom ? new Date(body.validFrom) : null) : existing.validFrom,
        validTo: body.validTo !== undefined ? (body.validTo ? new Date(body.validTo) : null) : existing.validTo,
      };
      const existingRules = (await getAdminRules()).map(toBusinessRule);
      const conflicts = detectConflicts(candidate, existingRules);
      if (candidate.ruleType === 'PROMO' && (candidate.config as { kind?: string }).kind === 'COMBO') {
        conflicts.push(...(await checkComboSetsExist(candidate)));
      }
      const errors = conflicts.filter((c) => c.severity === 'ERROR');
      if (errors.length > 0) {
        return NextResponse.json({ error: 'La regla tiene conflictos que impiden guardarla', conflicts: errors }, { status: 409 });
      }
    }

    const rule = await updateRule(id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.scope !== undefined ? { scope: body.scope } : {}),
      ...(body.scopeId !== undefined ? { scopeId: body.scopeId } : {}),
      ...(config !== undefined ? { config } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.priority !== undefined ? { priority: body.priority } : {}),
      ...(body.validFrom !== undefined ? { validFrom: body.validFrom ? new Date(body.validFrom) : null } : {}),
      ...(body.validTo !== undefined ? { validTo: body.validTo ? new Date(body.validTo) : null } : {}),
    });

    return NextResponse.json(rule);
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

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const existing = await getAdminRuleById(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.ruleType === 'COLOR_PAIRING') {
      return NextResponse.json(
        { error: 'Esta regla es gestionada por el sistema — no se puede eliminar manualmente. Cambia el modo de color del set a "mezclada" para desactivarla.' },
        { status: 403 }
      );
    }
    await deleteRule(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
