'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Settings2, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { RULE_TYPE_LABELS, type RuleTypeKey } from '@/lib/rule-config-schemas';

interface AdminRule {
  id: string;
  name: string;
  ruleType: RuleTypeKey;
  scope: string;
  scopeId: string | null;
  isActive: boolean;
  priority: number;
  conflictErrors: number;
  conflictWarnings: number;
}

function HealthBadge({ rule }: { rule: AdminRule }) {
  if (!rule.isActive) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  if (rule.conflictErrors > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-red-600"
        title={`${rule.conflictErrors} conflicto(s) grave(s) — el resultado de esta regla es indefinido`}
      >
        <AlertCircle className="w-4 h-4" /> {rule.conflictErrors}
      </span>
    );
  }
  if (rule.conflictWarnings > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-amber-600"
        title={`${rule.conflictWarnings} advertencia(s) — revisa la edición de esta regla para más detalle`}
      >
        <AlertTriangle className="w-4 h-4" /> {rule.conflictWarnings}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-600" title="Sin conflictos detectados">
      <CheckCircle2 className="w-4 h-4" />
    </span>
  );
}

const SCOPE_LABELS: Record<string, string> = {
  GLOBAL: 'Global',
  BRAND: 'Marca',
  SET_GROUP: 'Grupo de Sets',
  SET: 'Set',
  PRODUCT: 'Producto',
};

export default function AdminRulesPage() {
  const [rules, setRules] = useState<AdminRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/rules');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRules(data.rules);
    } catch {
      toast.error('Error al cargar las reglas de negocio');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  async function handleToggleActive(rule: AdminRule) {
    try {
      const res = await fetch(`/api/admin/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, isActive: !r.isActive } : r)));
    } catch {
      toast.error('Error al cambiar el estado de la regla');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de eliminar esta regla?')) return;
    try {
      const res = await fetch(`/api/admin/rules/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Regla eliminada');
      fetchRules();
    } catch {
      toast.error('Error al eliminar la regla');
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#111111]">Motor de Reglas</h1>
          <p className="text-sm text-gray-500 mt-1">Reglas de negocio del catálogo corporativo e individual</p>
        </div>
        <Link href="/admin/reglas/nueva">
          <Button className="bg-[#111111]">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Regla
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Ámbito</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Salud</TableHead>
                <TableHead>Activa</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    <Settings2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    No hay reglas de negocio registradas
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{RULE_TYPE_LABELS[rule.ruleType] ?? rule.ruleType}</Badge>
                    </TableCell>
                    <TableCell>{SCOPE_LABELS[rule.scope] ?? rule.scope}</TableCell>
                    <TableCell>{rule.priority}</TableCell>
                    <TableCell><HealthBadge rule={rule} /></TableCell>
                    <TableCell>
                      <Switch checked={rule.isActive} onCheckedChange={() => handleToggleActive(rule)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/reglas/${rule.id}`}>
                          <Button size="sm" variant="ghost"><Pencil className="w-4 h-4" /></Button>
                        </Link>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(rule.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
