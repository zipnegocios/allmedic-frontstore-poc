'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Package, Boxes, Images, Layers, Gauge, Clock } from 'lucide-react';

type Period = 'day' | 'week' | 'month';

interface ProductivityStats {
  userId: string;
  userName: string | null;
  dailyTarget: number;
  periodTarget: number;
  itemsByType: { PRODUCT: number; VARIANT: number; SET: number; MEDIA: number };
  totalItems: number;
  avgCreateSeconds: number | null;
  avgUpdateSeconds: number | null;
  compliancePct: number;
  status: 'green' | 'yellow' | 'red';
}

const PERIOD_LABELS: Record<Period, string> = { day: 'Día', week: 'Semana', month: 'Mes' };

const STATUS_COLORS: Record<ProductivityStats['status'], string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
};

const STATUS_LABELS: Record<ProductivityStats['status'], string> = {
  green: 'Cumple la meta',
  yellow: 'Por debajo de la meta',
  red: 'Muy por debajo de la meta',
};

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return `${hours}h ${remMinutes}min`;
}

function StatsCard({ stats, editable, onTargetSaved }: { stats: ProductivityStats; editable: boolean; onTargetSaved: () => void }) {
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState(String(stats.dailyTarget));
  const [saving, setSaving] = useState(false);

  async function handleSaveTarget() {
    const value = parseInt(targetInput, 10);
    if (!Number.isFinite(value) || value < 1) {
      toast.error('La meta debe ser un número mayor a 0');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/productivity', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: stats.userId, dailyTarget: value }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Meta actualizada');
      setEditingTarget(false);
      onTargetSaved();
    } catch {
      toast.error('Error al guardar la meta');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{stats.userName || 'Sin nombre'}</CardTitle>
          <Badge className={`${STATUS_COLORS[stats.status]} text-white border-none`}>
            {STATUS_LABELS[stats.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">Cumplimiento: {stats.totalItems} / {stats.periodTarget} ítems</span>
            <span className="font-semibold">{stats.compliancePct}%</span>
          </div>
          <Progress value={Math.min(stats.compliancePct, 100)} className="h-3" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <Package className="w-4 h-4 text-blue-500" />
            <div>
              <p className="text-xs text-gray-500">Productos</p>
              <p className="font-semibold">{stats.itemsByType.PRODUCT}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <Layers className="w-4 h-4 text-purple-500" />
            <div>
              <p className="text-xs text-gray-500">Variantes</p>
              <p className="font-semibold">{stats.itemsByType.VARIANT}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <Boxes className="w-4 h-4 text-green-500" />
            <div>
              <p className="text-xs text-gray-500">Sets</p>
              <p className="font-semibold">{stats.itemsByType.SET}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <Images className="w-4 h-4 text-orange-500" />
            <div>
              <p className="text-xs text-gray-500">Medios</p>
              <p className="font-semibold">{stats.itemsByType.MEDIA}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-3 border rounded-lg">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Tiempo prom. instalación</p>
              <p className="font-semibold text-sm">{formatDuration(stats.avgCreateSeconds)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 border rounded-lg">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Tiempo prom. edición</p>
              <p className="font-semibold text-sm">{formatDuration(stats.avgUpdateSeconds)}</p>
            </div>
          </div>
        </div>

        {editable && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <Gauge className="w-4 h-4 text-gray-400" />
            {editingTarget ? (
              <>
                <Input
                  type="number"
                  min={1}
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  className="w-24 h-8"
                />
                <span className="text-sm text-gray-500">ítems/día</span>
                <Button size="sm" onClick={handleSaveTarget} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingTarget(false)}>Cancelar</Button>
              </>
            ) : (
              <>
                <span className="text-sm text-gray-500">Meta diaria: {stats.dailyTarget} ítems/día</span>
                <Button size="sm" variant="outline" onClick={() => setEditingTarget(true)}>Editar</Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminProductivityPage() {
  const [period, setPeriod] = useState<Period>('day');
  const [stats, setStats] = useState<ProductivityStats[]>([]);
  const [scope, setScope] = useState<'ALL' | 'OWN'>('OWN');
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/productivity?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setStats(data.stats);
      setScope(data.scope);
    } catch {
      toast.error('Error al cargar productividad');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#111111]">Productividad</h1>
          <p className="text-sm text-gray-500 mt-1">
            {scope === 'ALL' ? 'Productividad de todos los Gestores del Catálogo' : 'Tu productividad'}
          </p>
        </div>
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as Period[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'outline'}
              className={period === p ? 'bg-[#111111]' : ''}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-center py-12 text-gray-500">Cargando...</p>
      ) : stats.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Gauge className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p>No hay Gestores del Catálogo registrados todavía</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {stats.map((s) => (
            <StatsCard key={s.userId} stats={s} editable={scope === 'ALL'} onTargetSaved={fetchStats} />
          ))}
        </div>
      )}
    </div>
  );
}
