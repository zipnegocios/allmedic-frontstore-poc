'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { RULE_TYPE_LABELS, type RuleTypeKey } from '@/lib/rule-config-schemas';
import { RuleDocPanel } from './RuleDocPanel';
import { RuleConflictsPanel } from './RuleConflictsPanel';
import type { RuleConflict } from '@/lib/rules-engine';
import { Trash2, Plus } from 'lucide-react';

type Scope = 'GLOBAL' | 'BRAND' | 'SET_GROUP' | 'SET' | 'PRODUCT';

interface ScopeOption {
  id: string;
  name: string;
}

interface RuleFormProps {
  mode: 'create' | 'edit';
  ruleId?: string;
  initial?: {
    name: string;
    ruleType: RuleTypeKey;
    scope: Scope;
    scopeId: string | null;
    config: Record<string, unknown>;
    isActive: boolean;
    priority: number;
  };
  /** Modo embebido (ej. drawer del ensamblador de sets): sin `router.push` al guardar —
   * el guardado/cancelación se comunican vía `onSaved`/`onCancel`. */
  embedded?: boolean;
  /** Fija y bloquea el ámbito a un Set concreto (usado por el ensamblador de sets: solo
   * permite crear/editar reglas de ámbito SET sobre el set que se está editando). */
  lockedScope?: { scope: 'SET'; scopeId: string };
  onSaved?: () => void;
  onCancel?: () => void;
}

// Ámbitos sin efecto real para tipos concretos — se deshabilitan en el selector en vez de
// dejarlos seleccionables sin que hagan nada. Ver RuleDocPanel para el detalle por tipo.
const SCOPE_UNAVAILABLE_BY_TYPE: Partial<Record<RuleTypeKey, Scope[]>> = {
  // INVENTORY_MODE se resuelve con el contexto del set (Set/Grupo/Marca) — el ámbito Producto
  // no participa en el cálculo real de demanda de stock.
  INVENTORY_MODE: ['PRODUCT'],
  // Descuento por volumen (individual) es un único descuento sobre el carrito retail completo
  // por diseño — no tiene sentido un ámbito más específico.
  VOLUME_DISCOUNT_RETAIL: ['BRAND', 'SET_GROUP', 'SET', 'PRODUCT'],
};

const DEFAULT_CONFIG_BY_TYPE: Record<RuleTypeKey, Record<string, unknown>> = {
  MIN_QUANTITY: { min: 12, countUnit: 'SETS' },
  MULTIPLES_ONLY: { multipleOf: 6 },
  QUANTITY_RANGE: { min: 12, max: null },
  SIZE_MODE: { mode: 'MATRIX' },
  PRICE_VISIBILITY: { showPrices: true, catalog: 'BOTH' },
  INVENTORY_MODE: { mode: 'IGNORE' },
  VOLUME_SCALE: { tiers: [{ minQty: 12, discountPct: 0 }] },
  PROMO: { kind: 'N_PLUS_ONE', buy: 13, free: 1 },
  COLOR_RESTRICTION: { colorCode: '', min: 6 },
  VOLUME_DISCOUNT_RETAIL: { tiers: [{ minItems: 3, pct: 10 }] },
};

const PROMO_KIND_LABELS: Record<string, string> = {
  N_PLUS_ONE: 'N + 1 (ej. 13 + 1 gratis)',
  PERCENT_OFF: 'Porcentaje de descuento',
  FIXED_AMOUNT_OFF: 'Monto fijo por unidad',
  FIXED_PRICE: 'Precio fijo promocional',
  NTH_UNIT_PCT: 'Descuento en la N-ésima unidad',
  THRESHOLD_DISCOUNT: 'Descuento por umbral de compra',
  GIFT: 'Regalo (informativo)',
  COMBO: 'Combo entre dos sets',
};

const DEFAULT_PROMO_CONFIG_BY_KIND: Record<string, Record<string, unknown>> = {
  N_PLUS_ONE: { kind: 'N_PLUS_ONE', buy: 13, free: 1 },
  PERCENT_OFF: { kind: 'PERCENT_OFF', pct: 10 },
  FIXED_AMOUNT_OFF: { kind: 'FIXED_AMOUNT_OFF', amountPerUnit: 5 },
  FIXED_PRICE: { kind: 'FIXED_PRICE', price: 10 },
  NTH_UNIT_PCT: { kind: 'NTH_UNIT_PCT', n: 2, pct: 50 },
  THRESHOLD_DISCOUNT: { kind: 'THRESHOLD_DISCOUNT', minSubtotal: 500, pct: 10 },
  GIFT: { kind: 'GIFT', minQty: 12, description: '' },
  COMBO: { kind: 'COMBO', triggerSetId: '', triggerMinQty: 1, targetSetId: '', pct: 10 },
};

export function RuleForm({ mode, ruleId, initial, embedded = false, lockedScope, onSaved, onCancel }: RuleFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? '');
  const [ruleType, setRuleType] = useState<RuleTypeKey>(initial?.ruleType ?? 'MIN_QUANTITY');
  const [scope, setScope] = useState<Scope>(initial?.scope ?? lockedScope?.scope ?? 'GLOBAL');
  const [scopeId, setScopeId] = useState<string | null>(initial?.scopeId ?? lockedScope?.scopeId ?? null);
  const [config, setConfig] = useState<Record<string, unknown>>(initial?.config ?? DEFAULT_CONFIG_BY_TYPE.MIN_QUANTITY);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [priority, setPriority] = useState(initial?.priority ?? 0);
  const [saving, setSaving] = useState(false);

  const [brands, setBrands] = useState<ScopeOption[]>([]);
  const [setGroups, setSetGroups] = useState<ScopeOption[]>([]);
  const [sets, setSets] = useState<ScopeOption[]>([]);
  const [products, setProducts] = useState<ScopeOption[]>([]);
  const [colors, setColors] = useState<{ id: string; name: string; code: string; hex: string }[]>([]);

  const [conflicts, setConflicts] = useState<RuleConflict[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/brands?limit=1000').then((r) => (r.ok ? r.json() : { brands: [] })),
      fetch('/api/admin/set-groups').then((r) => (r.ok ? r.json() : { groups: [] })),
      fetch('/api/admin/sets').then((r) => (r.ok ? r.json() : { sets: [] })),
      fetch('/api/admin/products/lite').then((r) => (r.ok ? r.json() : { products: [] })),
      fetch('/api/admin/colors?limit=1000').then((r) => (r.ok ? r.json() : { colors: [] })),
    ]).then(([b, g, s, p, c]) => {
      setBrands(b.brands ?? []);
      setSetGroups((g.groups ?? []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
      setSets((s.sets ?? []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
      setProducts((p.products ?? []).map((x: { id: string; name: string; brandName?: string }) => ({
        id: x.id,
        name: x.brandName ? `${x.name} (${x.brandName})` : x.name,
      })));
      setColors(c.colors ?? []);
    }).catch(() => {});
  }, []);

  // Verificación proactiva de conflictos: debounce ~600ms tras cualquier cambio relevante.
  useEffect(() => {
    setWarningsAcknowledged(false); // un cambio nuevo invalida cualquier confirmación previa
    if (scope !== 'GLOBAL' && !scopeId) {
      setConflicts([]);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingConflicts(true);
      try {
        const res = await fetch('/api/admin/rules/check-conflicts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: mode === 'edit' ? ruleId : '',
            name,
            ruleType,
            scope,
            scopeId: scope === 'GLOBAL' ? null : scopeId,
            config,
            priority,
            isActive,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setConflicts(data.conflicts ?? []);
        }
      } catch {
        // Fallback silencioso: si la verificación falla, no bloquea al admin — el
        // servidor igual re-valida ERRORs al guardar (regla de oro del proyecto).
      } finally {
        setCheckingConflicts(false);
      }
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleType, scope, scopeId, priority, config, isActive]);

  function handleRuleTypeChange(next: RuleTypeKey) {
    setRuleType(next);
    if (mode === 'create') setConfig(DEFAULT_CONFIG_BY_TYPE[next]);
  }

  function updateConfig(patch: Record<string, unknown>) {
    setConfig((prev) => ({ ...prev, ...patch }));
  }

  // COMBO cruza dos sets del carrito (los dos sets ya van en su config) y Descuento por volumen
  // (individual) es un único descuento sobre todo el carrito retail — ambos se configuran
  // únicamente en ámbito Global: se fuerza el ámbito y se bloquea el selector.
  const comboLocked = ruleType === 'PROMO' && config.kind === 'COMBO';
  const scopeForcedGlobal = comboLocked || ruleType === 'VOLUME_DISCOUNT_RETAIL';
  const scopeSelectDisabled = scopeForcedGlobal || Boolean(lockedScope);
  useEffect(() => {
    if (scopeForcedGlobal && scope !== 'GLOBAL') {
      setScope('GLOBAL');
      setScopeId(null);
    } else if (lockedScope && (scope !== lockedScope.scope || scopeId !== lockedScope.scopeId)) {
      setScope(lockedScope.scope);
      setScopeId(lockedScope.scopeId);
    }
  }, [scopeForcedGlobal, scope, scopeId, lockedScope]);

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    if (scope !== 'GLOBAL' && !scopeId) {
      toast.error('Selecciona un ámbito específico o cambia a Global');
      return;
    }

    if (ruleType === 'PROMO') {
      if (config.kind === 'THRESHOLD_DISCOUNT') {
        const hasPct = config.pct !== undefined && config.pct !== null && config.pct !== '';
        const hasAmount = config.amount !== undefined && config.amount !== null && config.amount !== '';
        if (hasPct === hasAmount) {
          toast.error('Elige exactamente una forma de descuento: porcentaje o monto fijo');
          return;
        }
      }
      if (config.kind === 'GIFT') {
        const hasMinQty = config.minQty !== undefined && config.minQty !== null && config.minQty !== '';
        const hasMinSubtotal = config.minSubtotal !== undefined && config.minSubtotal !== null && config.minSubtotal !== '';
        if (!hasMinQty && !hasMinSubtotal) {
          toast.error('Define al menos una condición: cantidad mínima o subtotal mínimo');
          return;
        }
        if (!String(config.description ?? '').trim()) {
          toast.error('Describe el regalo — el equipo de ventas necesita saber qué honrar');
          return;
        }
      }
      if (config.kind === 'COMBO' && (!config.triggerSetId || !config.targetSetId)) {
        toast.error('Selecciona el set disparador y el set objetivo del combo');
        return;
      }
    }

    const hasErrors = conflicts.some((c) => c.severity === 'ERROR');
    const hasUnacknowledgedWarnings = conflicts.some((c) => c.severity === 'WARNING') && !warningsAcknowledged;
    if (hasErrors) {
      toast.error('Resuelve los conflictos marcados en rojo antes de guardar');
      return;
    }
    if (hasUnacknowledgedWarnings) {
      toast.error('Confirma que entiendes las advertencias antes de guardar');
      return;
    }

    setSaving(true);
    try {
      const payload = mode === 'create'
        ? { name, ruleType, scope, scopeId: scope === 'GLOBAL' ? null : scopeId, config, priority }
        : { name, scope, scopeId: scope === 'GLOBAL' ? null : scopeId, config, isActive, priority };

      const url = mode === 'create' ? '/api/admin/rules' : `/api/admin/rules/${ruleId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al guardar la regla');
      }

      toast.success(mode === 'create' ? 'Regla creada' : 'Regla actualizada');
      if (embedded) {
        onSaved?.();
        return;
      }
      router.push('/admin/rules');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar la regla');
    } finally {
      setSaving(false);
    }
  }

  const scopeOptions: Record<Exclude<Scope, 'GLOBAL' | 'PRODUCT'>, ScopeOption[]> = {
    BRAND: brands,
    SET_GROUP: setGroups,
    SET: sets,
  };
  const unavailableScopes = SCOPE_UNAVAILABLE_BY_TYPE[ruleType] ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="mb-1 block">Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Mínimo 6 sets para uniformes escolares" />
          </div>

          <div>
            <Label className="mb-1 block">Tipo de regla</Label>
            <Select value={ruleType} onValueChange={(v) => handleRuleTypeChange(v as RuleTypeKey)} disabled={mode === 'edit'}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(RULE_TYPE_LABELS) as RuleTypeKey[]).map((t) => (
                  <SelectItem key={t} value={t}>{RULE_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mode === 'edit' && <p className="text-xs text-gray-400 mt-1">El tipo de regla no se puede cambiar al editar.</p>}
          </div>

          <div>
            <Label className="mb-1 block">Ámbito</Label>
            <Select
              value={scope}
              onValueChange={(v) => { setScope(v as Scope); setScopeId(null); }}
              disabled={scopeSelectDisabled}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="GLOBAL">Global (todo el catálogo)</SelectItem>
                <SelectItem value="BRAND" disabled={unavailableScopes.includes('BRAND')}>Marca</SelectItem>
                <SelectItem value="SET_GROUP" disabled={unavailableScopes.includes('SET_GROUP')}>Grupo de Sets</SelectItem>
                <SelectItem value="SET" disabled={unavailableScopes.includes('SET')}>Set específico</SelectItem>
                <SelectItem value="PRODUCT" disabled={unavailableScopes.includes('PRODUCT')}>Producto específico</SelectItem>
              </SelectContent>
            </Select>
            {comboLocked && <p className="text-xs text-gray-400 mt-1">Combo solo se configura en ámbito Global — los dos sets van en la configuración.</p>}
            {!comboLocked && ruleType === 'VOLUME_DISCOUNT_RETAIL' && (
              <p className="text-xs text-gray-400 mt-1">Descuento por volumen (individual) es un único descuento sobre todo el carrito retail — solo aplica en ámbito Global.</p>
            )}
            {lockedScope && (
              <p className="text-xs text-gray-400 mt-1">Esta regla se crea con ámbito Set, fijado a este set — cámbialo desde el panel de reglas si necesitas otro ámbito.</p>
            )}
          </div>

          {scope !== 'GLOBAL' && scope !== 'PRODUCT' && (
            <div>
              <Label className="mb-1 block">{scope === 'BRAND' ? 'Marca' : scope === 'SET_GROUP' ? 'Grupo de Sets' : 'Set'}</Label>
              <Select value={scopeId ?? ''} onValueChange={setScopeId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                <SelectContent>
                  {scopeOptions[scope].map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {scope === 'PRODUCT' && (
            <div>
              <Label className="mb-1 block">Producto</Label>
              <Select value={scopeId ?? ''} onValueChange={setScopeId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona un producto..." /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400 mt-1">
                En el catálogo corporativo aplica a todo set que incluya este producto entre sus piezas; en el individual, a su ficha de producto.
              </p>
            </div>
          )}

          <div>
            <Label className="mb-1 block">Prioridad (mayor gana en empates de ámbito)</Label>
            <Input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
          </div>

          {mode === 'edit' && (
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Regla activa</Label>
            </div>
          )}
        </div>

        <div className="border-t border-[#E5E5E5] pt-6">
          <h4 className="font-medium mb-3">Configuración de la regla</h4>
          <RuleConfigFields ruleType={ruleType} config={config} onChange={updateConfig} setConfig={setConfig} sets={sets} colors={colors} />
        </div>

        <RuleConflictsPanel
          conflicts={conflicts}
          checking={checkingConflicts}
          warningsAcknowledged={warningsAcknowledged}
          onAcknowledgeChange={setWarningsAcknowledged}
        />

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSubmit}
            disabled={
              saving ||
              conflicts.some((c) => c.severity === 'ERROR') ||
              (conflicts.some((c) => c.severity === 'WARNING') && !warningsAcknowledged)
            }
          >
            {saving ? 'Guardando...' : mode === 'create' ? 'Crear regla' : 'Guardar cambios'}
          </Button>
          {embedded && (
            <Button type="button" variant="outline" onClick={() => onCancel?.()}>
              Cancelar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>

    <RuleDocPanel ruleType={ruleType} scope={scope} onApplyExample={setConfig} />
    </div>
  );
}

function RuleConfigFields({
  ruleType,
  config,
  onChange,
  setConfig,
  sets,
  colors,
}: {
  ruleType: RuleTypeKey;
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  setConfig: (c: Record<string, unknown>) => void;
  sets: ScopeOption[];
  colors: { id: string; name: string; code: string; hex: string }[];
}) {
  switch (ruleType) {
    case 'MIN_QUANTITY':
      return (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-1 block">Cantidad mínima</Label>
            <Input type="number" value={Number(config.min ?? 0)} onChange={(e) => onChange({ min: Number(e.target.value) })} />
          </div>
          <div>
            <Label className="mb-1 block">Unidad</Label>
            <Select value={String(config.countUnit ?? 'SETS')} onValueChange={(v) => onChange({ countUnit: v })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SETS">Sets</SelectItem>
                <SelectItem value="PIECES">Piezas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case 'MULTIPLES_ONLY':
      return (
        <div>
          <Label className="mb-1 block">Múltiplo exacto</Label>
          <Input type="number" value={Number(config.multipleOf ?? 0)} onChange={(e) => onChange({ multipleOf: Number(e.target.value) })} />
        </div>
      );

    case 'QUANTITY_RANGE':
      return (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-1 block">Mínimo</Label>
            <Input type="number" value={Number(config.min ?? 0)} onChange={(e) => onChange({ min: Number(e.target.value) })} />
          </div>
          <div>
            <Label className="mb-1 block">Máximo (vacío = sin límite)</Label>
            <Input
              type="number"
              value={config.max === null || config.max === undefined ? '' : Number(config.max)}
              onChange={(e) => onChange({ max: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>
        </div>
      );

    case 'SIZE_MODE':
      return (
        <Select value={String(config.mode ?? 'MATRIX')} onValueChange={(v) => onChange({ mode: v })}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MATRIX">Matriz de tallas</SelectItem>
            <SelectItem value="PER_PIECE">Talla independiente por pieza</SelectItem>
            <SelectItem value="NO_SIZES">Sin tallas (solo cantidad)</SelectItem>
          </SelectContent>
        </Select>
      );

    case 'PRICE_VISIBILITY':
      return (
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(config.showPrices)} onCheckedChange={(v) => onChange({ showPrices: v })} />
            <Label>Mostrar precios</Label>
          </div>
          <div>
            <Label className="mb-1 block">Catálogo</Label>
            <Select value={String(config.catalog ?? 'BOTH')} onValueChange={(v) => onChange({ catalog: v })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                <SelectItem value="CORPORATE">Corporativo</SelectItem>
                <SelectItem value="BOTH">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case 'INVENTORY_MODE':
      return (
        <Select value={String(config.mode ?? 'IGNORE')} onValueChange={(v) => onChange({ mode: v })}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="IGNORE">Ignorar stock</SelectItem>
            <SelectItem value="BLOCK">Bloquear si no hay stock</SelectItem>
            <SelectItem value="INFORMATIVE">Solo informativo</SelectItem>
          </SelectContent>
        </Select>
      );

    case 'VOLUME_SCALE':
    case 'VOLUME_DISCOUNT_RETAIL': {
      const isRetail = ruleType === 'VOLUME_DISCOUNT_RETAIL';
      const qtyKey = isRetail ? 'minItems' : 'minQty';
      const pctKey = isRetail ? 'pct' : 'discountPct';
      const tiers = (config.tiers as Array<Record<string, number>>) ?? [];
      return (
        <div className="space-y-2">
          {tiers.map((tier, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                type="number"
                className="w-32"
                value={tier[qtyKey] ?? 0}
                onChange={(e) => {
                  const next = [...tiers];
                  next[idx] = { ...next[idx], [qtyKey]: Number(e.target.value) };
                  setConfig({ ...config, tiers: next });
                }}
                placeholder={isRetail ? 'Cant. mínima' : 'Sets mínimos'}
              />
              <span className="text-sm text-gray-500">unidades →</span>
              <Input
                type="number"
                className="w-24"
                value={tier[pctKey] ?? 0}
                onChange={(e) => {
                  const next = [...tiers];
                  next[idx] = { ...next[idx], [pctKey]: Number(e.target.value) };
                  setConfig({ ...config, tiers: next });
                }}
                placeholder="% desc."
              />
              <span className="text-sm text-gray-500">%</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfig({ ...config, tiers: tiers.filter((_, i) => i !== idx) })}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfig({ ...config, tiers: [...tiers, { [qtyKey]: 0, [pctKey]: 0 }] })}
          >
            <Plus className="w-4 h-4 mr-1" /> Agregar tramo
          </Button>
        </div>
      );
    }

    case 'PROMO': {
      const kind = String(config.kind ?? 'N_PLUS_ONE');
      function handleKindChange(next: string) {
        setConfig(DEFAULT_PROMO_CONFIG_BY_KIND[next] ?? { kind: next });
      }
      return (
        <div className="space-y-4">
          <div>
            <Label className="mb-1 block">Tipo de promoción</Label>
            <Select value={kind} onValueChange={handleKindChange}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PROMO_KIND_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {kind === 'N_PLUS_ONE' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1 block">Compra (buy)</Label>
                <Input type="number" value={Number(config.buy ?? 0)} onChange={(e) => onChange({ buy: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="mb-1 block">Gratis (free)</Label>
                <Input type="number" value={Number(config.free ?? 0)} onChange={(e) => onChange({ free: Number(e.target.value) })} />
              </div>
            </div>
          )}

          {kind === 'PERCENT_OFF' && (
            <div>
              <Label className="mb-1 block">Porcentaje de descuento</Label>
              <Input type="number" value={Number(config.pct ?? 0)} onChange={(e) => onChange({ pct: Number(e.target.value) })} />
            </div>
          )}

          {kind === 'FIXED_AMOUNT_OFF' && (
            <div>
              <Label className="mb-1 block">Monto fijo por unidad ($)</Label>
              <Input type="number" value={Number(config.amountPerUnit ?? 0)} onChange={(e) => onChange({ amountPerUnit: Number(e.target.value) })} />
            </div>
          )}

          {kind === 'FIXED_PRICE' && (
            <div>
              <Label className="mb-1 block">Precio promocional por set ($)</Label>
              <Input type="number" value={Number(config.price ?? 0)} onChange={(e) => onChange({ price: Number(e.target.value) })} />
              <p className="text-xs text-gray-400 mt-1">Si este precio es mayor o igual al precio normal, no se descuenta nada.</p>
            </div>
          )}

          {kind === 'NTH_UNIT_PCT' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1 block">Cada N unidades (n)</Label>
                <Input type="number" min={2} value={Number(config.n ?? 2)} onChange={(e) => onChange({ n: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="mb-1 block">% de descuento en esa unidad</Label>
                <Input type="number" value={Number(config.pct ?? 0)} onChange={(e) => onChange({ pct: Number(e.target.value) })} />
              </div>
            </div>
          )}

          {kind === 'THRESHOLD_DISCOUNT' && (
            <div className="space-y-3">
              <div>
                <Label className="mb-1 block">Subtotal mínimo del contexto ($)</Label>
                <Input type="number" value={Number(config.minSubtotal ?? 0)} onChange={(e) => onChange({ minSubtotal: Number(e.target.value) })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block">Porcentaje de descuento</Label>
                  <Input
                    type="number"
                    value={config.pct === undefined ? '' : Number(config.pct)}
                    onChange={(e) => onChange({ pct: e.target.value === '' ? undefined : Number(e.target.value), amount: undefined })}
                    placeholder="Ej. 10"
                  />
                </div>
                <div>
                  <Label className="mb-1 block">Monto fijo ($)</Label>
                  <Input
                    type="number"
                    value={config.amount === undefined ? '' : Number(config.amount)}
                    onChange={(e) => onChange({ amount: e.target.value === '' ? undefined : Number(e.target.value), pct: undefined })}
                    placeholder="Ej. 50"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400">Completa exactamente uno de los dos campos — el otro se limpia automáticamente.</p>
            </div>
          )}

          {kind === 'GIFT' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block">Cantidad mínima (sets)</Label>
                  <Input
                    type="number"
                    value={config.minQty === undefined ? '' : Number(config.minQty)}
                    onChange={(e) => onChange({ minQty: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label className="mb-1 block">Subtotal mínimo ($)</Label>
                  <Input
                    type="number"
                    value={config.minSubtotal === undefined ? '' : Number(config.minSubtotal)}
                    onChange={(e) => onChange({ minSubtotal: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <Label className="mb-1 block">Descripción del regalo</Label>
                <Input
                  value={String(config.description ?? '')}
                  onChange={(e) => onChange({ description: e.target.value })}
                  placeholder="Ej. 12 gorros quirúrgicos de cortesía"
                />
              </div>
              <p className="text-xs text-amber-600">No tiene efecto monetario — solo genera un aviso en el carrito y en la cotización para que ventas lo honre.</p>
            </div>
          )}

          {kind === 'COMBO' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block">Set disparador</Label>
                  <Select value={String(config.triggerSetId ?? '')} onValueChange={(v) => onChange({ triggerSetId: v })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona un set..." /></SelectTrigger>
                    <SelectContent>
                      {sets.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block">Cantidad mínima del disparador</Label>
                  <Input type="number" value={Number(config.triggerMinQty ?? 1)} onChange={(e) => onChange({ triggerMinQty: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1 block">Set objetivo (recibe el descuento)</Label>
                  <Select value={String(config.targetSetId ?? '')} onValueChange={(v) => onChange({ targetSetId: v })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona un set..." /></SelectTrigger>
                    <SelectContent>
                      {sets.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block">% de descuento en el set objetivo</Label>
                  <Input type="number" value={Number(config.pct ?? 0)} onChange={(e) => onChange({ pct: Number(e.target.value) })} />
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    case 'COLOR_RESTRICTION':
      return (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-1 block">Color</Label>
            <Select value={String(config.colorCode ?? '')} onValueChange={(v) => onChange({ colorCode: v })}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona un color..." /></SelectTrigger>
              <SelectContent>
                {colors.map((c) => (
                  <SelectItem key={c.id} value={c.code}>
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full border border-gray-300 inline-block" style={{ backgroundColor: c.hex }} />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">Mínimo requerido</Label>
            <Input type="number" value={Number(config.min ?? 0)} onChange={(e) => onChange({ min: Number(e.target.value) })} />
          </div>
        </div>
      );

    default:
      return null;
  }
}
