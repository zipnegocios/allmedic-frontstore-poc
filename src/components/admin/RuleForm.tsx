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
}

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

export function RuleForm({ mode, ruleId, initial }: RuleFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? '');
  const [ruleType, setRuleType] = useState<RuleTypeKey>(initial?.ruleType ?? 'MIN_QUANTITY');
  const [scope, setScope] = useState<Scope>(initial?.scope ?? 'GLOBAL');
  const [scopeId, setScopeId] = useState<string | null>(initial?.scopeId ?? null);
  const [config, setConfig] = useState<Record<string, unknown>>(initial?.config ?? DEFAULT_CONFIG_BY_TYPE.MIN_QUANTITY);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [priority, setPriority] = useState(initial?.priority ?? 0);
  const [saving, setSaving] = useState(false);

  const [brands, setBrands] = useState<ScopeOption[]>([]);
  const [setGroups, setSetGroups] = useState<ScopeOption[]>([]);
  const [sets, setSets] = useState<ScopeOption[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/brands?limit=1000').then((r) => (r.ok ? r.json() : { brands: [] })),
      fetch('/api/admin/set-groups').then((r) => (r.ok ? r.json() : { groups: [] })),
      fetch('/api/admin/sets').then((r) => (r.ok ? r.json() : { sets: [] })),
    ]).then(([b, g, s]) => {
      setBrands(b.brands ?? []);
      setSetGroups((g.groups ?? []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
      setSets((s.sets ?? []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
    }).catch(() => {});
  }, []);

  function handleRuleTypeChange(next: RuleTypeKey) {
    setRuleType(next);
    if (mode === 'create') setConfig(DEFAULT_CONFIG_BY_TYPE[next]);
  }

  function updateConfig(patch: Record<string, unknown>) {
    setConfig((prev) => ({ ...prev, ...patch }));
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    if (scope !== 'GLOBAL' && !scopeId) {
      toast.error('Selecciona un ámbito específico o cambia a Global');
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

  return (
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
            <Select value={scope} onValueChange={(v) => { setScope(v as Scope); setScopeId(null); }}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="GLOBAL">Global (todo el catálogo)</SelectItem>
                <SelectItem value="BRAND">Marca</SelectItem>
                <SelectItem value="SET_GROUP">Grupo de Sets</SelectItem>
                <SelectItem value="SET">Set específico</SelectItem>
                <SelectItem value="PRODUCT">Producto específico</SelectItem>
              </SelectContent>
            </Select>
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
              <Label className="mb-1 block">ID del producto</Label>
              <Input
                value={scopeId ?? ''}
                onChange={(e) => setScopeId(e.target.value)}
                placeholder="UUID del producto (cópialo desde /admin/products/[id])"
              />
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
          <RuleConfigFields ruleType={ruleType} config={config} onChange={updateConfig} setConfig={setConfig} />
        </div>

        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? 'Guardando...' : mode === 'create' ? 'Crear regla' : 'Guardar cambios'}
        </Button>
      </CardContent>
    </Card>
  );
}

function RuleConfigFields({
  ruleType,
  config,
  onChange,
  setConfig,
}: {
  ruleType: RuleTypeKey;
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  setConfig: (c: Record<string, unknown>) => void;
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

    case 'PROMO':
      return (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="mb-1 block">Tipo</Label>
            <Select value={String(config.kind ?? 'N_PLUS_ONE')} onValueChange={(v) => onChange({ kind: v })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="N_PLUS_ONE">N + 1 (ej. 13+1)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">Compra (buy)</Label>
            <Input type="number" value={Number(config.buy ?? 0)} onChange={(e) => onChange({ buy: Number(e.target.value) })} />
          </div>
          <div>
            <Label className="mb-1 block">Gratis (free)</Label>
            <Input type="number" value={Number(config.free ?? 0)} onChange={(e) => onChange({ free: Number(e.target.value) })} />
          </div>
        </div>
      );

    case 'COLOR_RESTRICTION':
      return (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-1 block">Código de color</Label>
            <Input value={String(config.colorCode ?? '')} onChange={(e) => onChange({ colorCode: e.target.value })} placeholder="Ej. PINK" />
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
