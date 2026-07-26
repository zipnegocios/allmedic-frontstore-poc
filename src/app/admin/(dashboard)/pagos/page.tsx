'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Wallet } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

interface RateRow {
  id: string;
  componentType: 'VARIANT' | 'PRODUCT' | 'SET' | 'MEDIA' | 'TIME_BONUS';
  enabled: boolean;
  amount: string | null;
  bonusPerUnitUnderTarget: string | null;
  penaltyPerUnitOverTarget: string | null;
}

interface Tier {
  id: string;
  name: string;
  rates: RateRow[];
}

interface AssigneeUser {
  id: string;
  name: string | null;
  email: string;
  tierId: string | null;
  requiresAssignedTaskForPayment: boolean;
}

interface Period {
  id: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED' | 'PAID';
  notes: string | null;
}

const COMPONENT_LABELS: Record<RateRow['componentType'], string> = {
  VARIANT: 'Por variante instalada',
  PRODUCT: 'Por producto creado',
  SET: 'Por set armado',
  MEDIA: 'Por medio subido',
  TIME_BONUS: 'Bono/penalización por tiempo',
};

export default function PagosPage() {
  const { isAdmin } = usePermissions();
  const [moduleEnabled, setModuleEnabled] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    fetch('/api/admin/payment-settings').then(async (res) => {
      if (res.ok) setModuleEnabled((await res.json()).enabled);
      setLoadingSettings(false);
    });
  }, []);

  async function toggleModule(enabled: boolean) {
    setModuleEnabled(enabled);
    const res = await fetch('/api/admin/payment-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      setModuleEnabled(!enabled);
      toast.error('No se pudo actualizar el interruptor');
      return;
    }
    toast.success(enabled ? 'Módulo de pagos activado' : 'Módulo de pagos desactivado');
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#111111]">Pagos por productividad</h1>
          <p className="text-sm text-gray-500 mt-1">Tarifas, tiers y períodos de pago del Gestor del Catálogo</p>
        </div>
        {isAdmin && !loadingSettings && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Módulo activo</span>
            <Switch checked={moduleEnabled} onCheckedChange={toggleModule} />
          </div>
        )}
      </div>

      {!moduleEnabled && !loadingSettings && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-800">
            El módulo de pagos está desactivado — los cálculos y el desglose no se pueden ejecutar
            hasta activarlo. Los datos de configuración (tiers, tarifas) sí se pueden editar mientras tanto.
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="tiers">
        <TabsList>
          <TabsTrigger value="tiers">Tiers y tarifas</TabsTrigger>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="periods">Períodos</TabsTrigger>
        </TabsList>

        <TabsContent value="tiers" className="mt-6">
          <TiersPanel />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UsersPanel />
        </TabsContent>
        <TabsContent value="periods" className="mt-6">
          <PeriodsPanel moduleEnabled={moduleEnabled} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TiersPanel() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTierName, setNewTierName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/payment-tiers');
      if (res.ok) setTiers((await res.json()).tiers);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreateTier() {
    if (!newTierName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/payment-tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTierName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'No se pudo crear el tier');
        return;
      }
      setNewTierName('');
      load();
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Cargando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 max-w-sm">
        <Input value={newTierName} onChange={(e) => setNewTierName(e.target.value)} placeholder="Nombre del tier (ej. Junior)" />
        <Button onClick={handleCreateTier} disabled={creating}><Plus className="w-4 h-4 mr-1" />Crear</Button>
      </div>

      {tiers.map((tier) => (
        <TierCard key={tier.id} tier={tier} onChanged={load} />
      ))}
    </div>
  );
}

function TierCard({ tier, onChanged }: { tier: Tier; onChanged: () => void }) {
  async function updateRate(componentType: RateRow['componentType'], patch: Partial<RateRow>) {
    const current = tier.rates.find((r) => r.componentType === componentType);
    const res = await fetch(`/api/admin/payment-tiers/${tier.id}/rates`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        componentType,
        enabled: patch.enabled ?? current?.enabled ?? false,
        amount: patch.amount !== undefined ? patch.amount : current?.amount ?? null,
        bonusPerUnitUnderTarget: patch.bonusPerUnitUnderTarget !== undefined ? patch.bonusPerUnitUnderTarget : current?.bonusPerUnitUnderTarget ?? null,
        penaltyPerUnitOverTarget: patch.penaltyPerUnitOverTarget !== undefined ? patch.penaltyPerUnitOverTarget : current?.penaltyPerUnitOverTarget ?? null,
      }),
    });
    if (!res.ok) {
      toast.error('No se pudo guardar la tarifa');
      return;
    }
    onChanged();
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{tier.name}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {(['VARIANT', 'PRODUCT', 'SET', 'MEDIA', 'TIME_BONUS'] as const).map((componentType) => {
          const rate = tier.rates.find((r) => r.componentType === componentType);
          return (
            <div key={componentType} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
              <Switch
                checked={rate?.enabled ?? false}
                onCheckedChange={(checked) => updateRate(componentType, { enabled: checked })}
              />
              <span className="text-sm flex-1">{COMPONENT_LABELS[componentType]}</span>
              {componentType === 'TIME_BONUS' ? (
                <div className="flex gap-2">
                  <Input
                    type="number" step="0.01" placeholder="Bono/u"
                    defaultValue={rate?.bonusPerUnitUnderTarget ?? ''}
                    className="w-24"
                    onBlur={(e) => updateRate(componentType, { bonusPerUnitUnderTarget: e.target.value || null })}
                  />
                  <Input
                    type="number" step="0.01" placeholder="Penal/u"
                    defaultValue={rate?.penaltyPerUnitOverTarget ?? ''}
                    className="w-24"
                    onBlur={(e) => updateRate(componentType, { penaltyPerUnitOverTarget: e.target.value || null })}
                  />
                </div>
              ) : (
                <Input
                  type="number" step="0.01" placeholder="Monto $"
                  defaultValue={rate?.amount ?? ''}
                  className="w-28"
                  onBlur={(e) => updateRate(componentType, { amount: e.target.value || null })}
                />
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function UsersPanel() {
  const [assignees, setAssignees] = useState<AssigneeUser[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, tiersRes] = await Promise.all([
        fetch('/api/admin/payment-tiers/assignees'),
        fetch('/api/admin/payment-tiers'),
      ]);
      if (usersRes.ok) setAssignees((await usersRes.json()).users);
      if (tiersRes.ok) setTiers((await tiersRes.json()).tiers);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function updateAssignment(userId: string, tierId: string | null, requiresAssignedTaskForPayment: boolean) {
    const res = await fetch(`/api/admin/users/${userId}/payment-tier`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tierId, requiresAssignedTaskForPayment }),
    });
    if (!res.ok) {
      toast.error('No se pudo actualizar');
      return;
    }
    load();
  }

  if (loading) return <p className="text-sm text-gray-500">Cargando...</p>;

  return (
    <div className="space-y-3">
      {assignees.map((user) => (
        <Card key={user.id}>
          <CardContent className="p-4 flex items-center gap-4 flex-wrap">
            <div className="min-w-[160px]">
              <p className="font-medium">{user.name ?? user.email}</p>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
            <Select
              value={user.tierId ?? 'none'}
              onValueChange={(v) => updateAssignment(user.id, v === 'none' ? null : v, user.requiresAssignedTaskForPayment)}
            >
              <SelectTrigger className="w-48"><SelectValue placeholder="Sin tier" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin tier</SelectItem>
                {tiers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch
                checked={user.requiresAssignedTaskForPayment}
                onCheckedChange={(checked) => updateAssignment(user.id, user.tierId, checked)}
              />
              <span className="text-sm text-gray-500">Requiere tarea asignada</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PeriodsPanel({ moduleEnabled }: { moduleEnabled: boolean }) {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/payment-periods');
      if (res.ok) setPeriods((await res.json()).periods);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!startDate || !endDate) {
      toast.error('Fecha de inicio y fin son obligatorias');
      return;
    }
    const res = await fetch('/api/admin/payment-periods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, endDate, notes: notes || null }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? 'No se pudo crear el período');
      return;
    }
    setCreateOpen(false);
    setStartDate(''); setEndDate(''); setNotes('');
    load();
  }

  if (loading) return <p className="text-sm text-gray-500">Cargando...</p>;

  return (
    <div className="space-y-4">
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogTrigger asChild>
          <Button disabled={!moduleEnabled}><Plus className="w-4 h-4 mr-1.5" />Nuevo período</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo período de pago</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Fecha inicio</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Fecha fin</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas (opcional)" rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {periods.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-gray-500">
          <Wallet className="w-8 h-8 mx-auto mb-2 text-gray-300" />No hay períodos creados.
        </CardContent></Card>
      ) : (
        periods.map((period) => (
          <PeriodCard
            key={period.id}
            period={period}
            moduleEnabled={moduleEnabled}
            expanded={selectedPeriod === period.id}
            onToggle={() => setSelectedPeriod(selectedPeriod === period.id ? null : period.id)}
            onChanged={load}
          />
        ))
      )}
    </div>
  );
}

const PERIOD_STATUS_LABELS: Record<Period['status'], string> = { OPEN: 'Abierto', CLOSED: 'Cerrado', PAID: 'Pagado' };
const PERIOD_STATUS_COLORS: Record<Period['status'], string> = {
  OPEN: 'bg-blue-100 text-blue-700', CLOSED: 'bg-amber-100 text-amber-700', PAID: 'bg-emerald-100 text-emerald-700',
};

interface BreakdownItem {
  id: string;
  userId: string;
  userName: string | null;
  computedAmount: string;
  manualAdjustment: string;
  adjustmentReason: string | null;
  finalAmount: string;
  voidedItemsCount: number;
}

function PeriodCard({ period, moduleEnabled, expanded, onToggle, onChanged }: {
  period: Period; moduleEnabled: boolean; expanded: boolean; onToggle: () => void; onChanged: () => void;
}) {
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const loadBreakdown = useCallback(async () => {
    const res = await fetch(`/api/admin/payment-periods/${period.id}`);
    if (res.ok) setBreakdown((await res.json()).breakdown);
  }, [period.id]);

  useEffect(() => {
    if (expanded) loadBreakdown();
  }, [expanded, loadBreakdown]);

  async function recalculate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/payment-periods/${period.id}/recalculate`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'No se pudo recalcular');
        return;
      }
      toast.success('Período recalculado');
      loadBreakdown();
    } finally {
      setBusy(false);
    }
  }

  async function transition(action: 'close' | 'mark-paid') {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/payment-periods/${period.id}/${action}`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'No se pudo actualizar el período');
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function submitAdjustment(userId: string) {
    const value = parseFloat(adjustAmount);
    if (!Number.isFinite(value) || !adjustReason.trim()) {
      toast.error('Monto y motivo son obligatorios');
      return;
    }
    const res = await fetch(`/api/admin/payment-periods/${period.id}/adjustments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, adjustment: value, reason: adjustReason }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? 'No se pudo aplicar el ajuste');
      return;
    }
    setAdjustOpen(null); setAdjustAmount(''); setAdjustReason('');
    loadBreakdown();
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <button className="text-left flex-1" onClick={onToggle}>
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {new Date(period.startDate).toLocaleDateString('es-EC')} — {new Date(period.endDate).toLocaleDateString('es-EC')}
              </span>
              <Badge className={`${PERIOD_STATUS_COLORS[period.status]} border-none text-xs`}>{PERIOD_STATUS_LABELS[period.status]}</Badge>
            </div>
            {period.notes && <p className="text-xs text-gray-400 mt-0.5">{period.notes}</p>}
          </button>
          <div className="flex gap-2">
            {period.status === 'OPEN' && (
              <>
                <Button size="sm" variant="outline" disabled={busy || !moduleEnabled} onClick={recalculate}>Recalcular</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => transition('close')}>Cerrar</Button>
              </>
            )}
            {period.status === 'CLOSED' && (
              <Button size="sm" disabled={busy} onClick={() => transition('mark-paid')}>Marcar como pagado</Button>
            )}
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
            {breakdown.length === 0 ? (
              <p className="text-sm text-gray-400">Sin ítems calculados — usa &quot;Recalcular&quot; si el período está abierto.</p>
            ) : (
              breakdown.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium">{item.userName ?? '—'}</p>
                    <p className="text-xs text-gray-400">
                      Calculado: ${item.computedAmount} {Number(item.manualAdjustment) !== 0 && `+ ajuste ${item.manualAdjustment}`}
                      {item.voidedItemsCount > 0 && ` · ${item.voidedItemsCount} ítems anulados`}
                    </p>
                    {item.adjustmentReason && <p className="text-xs text-gray-400">Motivo: {item.adjustmentReason}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">${item.finalAmount}</span>
                    {period.status !== 'PAID' && (
                      <Dialog open={adjustOpen === item.userId} onOpenChange={(o) => setAdjustOpen(o ? item.userId : null)}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost">Ajustar</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Ajuste manual — {item.userName}</DialogTitle></DialogHeader>
                          <div className="space-y-3">
                            <Input type="number" step="0.01" placeholder="Monto (+/-)" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
                            <Textarea placeholder="Motivo (obligatorio)" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} rows={2} />
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setAdjustOpen(null)}>Cancelar</Button>
                            <Button onClick={() => submitAdjustment(item.userId)}>Aplicar ajuste</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
