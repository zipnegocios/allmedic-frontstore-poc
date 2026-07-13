'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Check, X, Ban, Eye } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminListCard, type AdminListCardAction } from '@/components/admin/AdminListCard';
import { getCorporateAccountActionFlags } from '@/lib/corporate-account-actions';

interface CorporateAccount {
  id: string;
  ruc: string;
  razonSocial: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  sector: string | null;
  status: string;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: 'outline' | 'secondary' | 'destructive' }> = {
  PENDING: { label: 'Pendiente', variant: 'secondary' },
  APPROVED: { label: 'Aprobada', variant: 'outline' },
  REJECTED: { label: 'Rechazada', variant: 'destructive' },
  SUSPENDED: { label: 'Suspendida', variant: 'destructive' },
};

const FILTER_OPTIONS = [
  { value: 'ALL', label: 'Todos los estados' },
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'APPROVED', label: 'Aprobadas' },
  { value: 'REJECTED', label: 'Rechazadas' },
  { value: 'SUSPENDED', label: 'Suspendidas' },
];

export default function AdminCorporateAccountsPage() {
  const [accounts, setAccounts] = useState<CorporateAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
      const res = await fetch(`/api/admin/corporate-accounts${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setAccounts(data.accounts);
    } catch {
      toast.error('Error al cargar cuentas corporativas');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  async function updateStatus(id: string, status: 'APPROVED' | 'REJECTED' | 'SUSPENDED') {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admin/corporate-accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const labels: Record<string, string> = { APPROVED: 'aprobada', REJECTED: 'rechazada', SUSPENDED: 'suspendida' };
      toast.success(`Cuenta ${labels[status]} correctamente`);
      fetchAccounts();
    } catch {
      toast.error('Error al actualizar el estado de la cuenta');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#111111]">Cuentas Corporativas</h1>
          <p className="text-sm text-gray-500 mt-1">Registro y aprobación de clientes del catálogo corporativo</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-48 min-h-11 md:min-h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>RUC</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    <Building2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    No hay cuentas corporativas con este filtro
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => {
                  const statusInfo = STATUS_LABELS[account.status] || { label: account.status, variant: 'secondary' as const };
                  const isUpdating = updatingId === account.id;
                  return (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div className="font-medium">{account.razonSocial}</div>
                        <div className="text-xs text-gray-500">{account.email}</div>
                      </TableCell>
                      <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">{account.ruc}</code></TableCell>
                      <TableCell>
                        <div>{account.contactName}</div>
                        <div className="text-xs text-gray-500">{account.phone}</div>
                      </TableCell>
                      <TableCell>{account.city}</TableCell>
                      <TableCell><Badge variant={statusInfo.variant}>{statusInfo.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {account.status !== 'APPROVED' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isUpdating}
                              onClick={() => updateStatus(account.id, 'APPROVED')}
                              className="text-[#34C759]"
                              title="Aprobar"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          {account.status !== 'REJECTED' && account.status === 'PENDING' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isUpdating}
                              onClick={() => updateStatus(account.id, 'REJECTED')}
                              className="text-red-500"
                              title="Rechazar"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                          {account.status === 'APPROVED' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isUpdating}
                              onClick={() => updateStatus(account.id, 'SUSPENDED')}
                              className="text-amber-600"
                              title="Suspender"
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                          )}
                          <Link href={`/admin/cuentas-corporativas/${account.id}`}>
                            <Button size="sm" variant="ghost" title="Ver detalle"><Eye className="w-4 h-4" /></Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Vista tarjetas (mobile) — misma fuente de datos y handlers que la tabla */}
      <div className="md:hidden">
        {loading ? (
          <p className="text-center py-8 text-gray-500">Cargando...</p>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Building2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No hay cuentas corporativas con este filtro</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {accounts.map((account) => {
              const statusInfo = STATUS_LABELS[account.status] || { label: account.status, variant: 'secondary' as const };
              const isUpdating = updatingId === account.id;
              const { canApprove, canReject, canSuspend } = getCorporateAccountActionFlags(account.status);

              const cardActions: AdminListCardAction[] = [];
              if (canApprove) {
                cardActions.push({
                  key: 'approve',
                  label: 'Aprobar',
                  icon: <Check className="w-4 h-4 text-[#34C759]" />,
                  disabled: isUpdating,
                  onSelect: () => updateStatus(account.id, 'APPROVED'),
                });
              }
              if (canReject) {
                cardActions.push({
                  key: 'reject',
                  label: 'Rechazar',
                  icon: <X className="w-4 h-4" />,
                  variant: 'destructive',
                  disabled: isUpdating,
                  onSelect: () => updateStatus(account.id, 'REJECTED'),
                });
              }
              if (canSuspend) {
                cardActions.push({
                  key: 'suspend',
                  label: 'Suspender',
                  icon: <Ban className="w-4 h-4 text-amber-600" />,
                  disabled: isUpdating,
                  onSelect: () => updateStatus(account.id, 'SUSPENDED'),
                });
              }

              return (
                <AdminListCard
                  key={account.id}
                  href={`/admin/cuentas-corporativas/${account.id}`}
                  aria-label={`Ver detalle de ${account.razonSocial}`}
                  title={account.razonSocial}
                  subtitle={account.email}
                  badges={<Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>}
                  meta={
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{account.ruc}</code>
                      <span aria-hidden="true">·</span>
                      <span>{account.contactName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{account.phone}</span>
                      <span aria-hidden="true">·</span>
                      <span>{account.city}</span>
                    </div>
                  }
                  actions={cardActions}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
