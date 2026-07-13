'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from '@/lib/lead-status';

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
    <div className="p-8">
      <h1 className="text-3xl font-bold text-[#111111] mb-8">Pedidos</h1>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STATUSES}>Todos</SelectItem>
                <SelectItem value="SENT">Enviado</SelectItem>
                <SelectItem value="PROCESSING">En proceso</SelectItem>
                <SelectItem value="COMPLETED">Completado</SelectItem>
                <SelectItem value="CANCELLED">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">No hay pedidos</TableCell>
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
                          <SelectItem value="SENT">Enviado</SelectItem>
                          <SelectItem value="PROCESSING">En proceso</SelectItem>
                          <SelectItem value="COMPLETED">Completado</SelectItem>
                          <SelectItem value="CANCELLED">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(lead.createdAt).toLocaleDateString('es-EC')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
