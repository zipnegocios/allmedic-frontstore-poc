'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Eye, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from '@/lib/lead-status';
import { AdminListCard } from '@/components/admin/AdminListCard';

interface Lead {
  id: string;
  customerName: string;
  customerCity: string;
  customerPhone: string | null;
  totalItems: number;
  subtotal: string;
  status: string;
  createdAt: Date;
}

const ALL_STATUSES = 'ALL';

const LEAD_STATUS_OPTIONS = [
  { value: 'SENT', label: 'Enviado' },
  { value: 'PROCESSING', label: 'En proceso' },
  { value: 'COTIZADO', label: 'Cotizado' },
  { value: 'COMPLETED', label: 'Completado' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [status, setStatus] = useState(ALL_STATUSES);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== ALL_STATUSES) params.set('status', status);
      params.set('page', String(page));
      params.set('limit', '20');
      const res = await fetch(`/api/admin/leads?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setLeads(data.leads);
      setTotalPages(data.pages);
    } catch {
      toast.error('Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  async function handleStatusChange(id: string, newStatus: string) {
    try {
      const res = await fetch(`/api/admin/leads?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success('Estado actualizado');
      fetchLeads();
    } catch {
      toast.error('Error al actualizar estado');
    }
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold text-[#111111] mb-8">Pedidos</h1>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-full md:w-[200px] min-h-11 md:min-h-9">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STATUSES}>Todos</SelectItem>
                {LEAD_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Vista tabla (desktop) */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Artículos</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">No hay pedidos</TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{lead.customerName}</p>
                        <p className="text-sm text-gray-500">{lead.customerPhone || 'Sin teléfono'}</p>
                      </div>
                    </TableCell>
                    <TableCell>{lead.customerCity}</TableCell>
                    <TableCell>{lead.totalItems}</TableCell>
                    <TableCell className="font-medium">${lead.subtotal}</TableCell>
                    <TableCell>
                      <Select
                        value={lead.status}
                        onValueChange={(v) => handleStatusChange(lead.id, v)}
                      >
                        <SelectTrigger className="w-[140px] h-8">
                          <Badge className={LEAD_STATUS_COLORS[lead.status] || 'bg-gray-100'}>
                            {LEAD_STATUS_LABELS[lead.status] || lead.status}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_STATUS_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(lead.createdAt).toLocaleDateString('es-EC')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/prospectos/${lead.id}`}>
                        <Button size="sm" variant="ghost"><Eye className="w-4 h-4" /></Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Vista tarjetas (mobile) — misma fuente de datos y handlers que la tabla */}
      <div className="md:hidden">
        {loading ? (
          <p className="text-center py-8 text-gray-500">Cargando...</p>
        ) : leads.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Inbox className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No hay pedidos</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {leads.map((lead) => (
              <AdminListCard
                key={lead.id}
                href={`/admin/prospectos/${lead.id}`}
                aria-label={`Ver pedido de ${lead.customerName}`}
                title={lead.customerName}
                subtitle={`${lead.customerPhone || 'Sin teléfono'} · ${lead.customerCity}`}
                meta={
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{lead.totalItems} artículo{lead.totalItems === 1 ? '' : 's'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-[#111111]">${lead.subtotal}</span>
                    <span aria-hidden="true">·</span>
                    <span>{new Date(lead.createdAt).toLocaleDateString('es-EC')}</span>
                  </div>
                }
                inlineControl={
                  <Select
                    value={lead.status}
                    onValueChange={(v) => handleStatusChange(lead.id, v)}
                  >
                    <SelectTrigger className="h-11 w-full max-w-[220px] px-3">
                      <Badge className={LEAD_STATUS_COLORS[lead.status] || 'bg-gray-100'}>
                        {LEAD_STATUS_LABELS[lead.status] || lead.status}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm px-2 text-center">Página {page} de {totalPages}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
