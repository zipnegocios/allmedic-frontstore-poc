'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, Eye, Mail, Globe, Plus, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { QUOTE_STATUS_LABELS, QUOTE_OUTCOME_LABELS, QUOTE_CHANNEL_LABELS, isQuoteExpired } from '@/lib/quote-status';
import { countActiveFilters } from '@/lib/admin-list-filters';
import { AdminListCard } from '@/components/admin/AdminListCard';
import { ResponsiveDialog } from '@/components/admin/ResponsiveDialog';

interface AdminQuote {
  id: string;
  quoteNumber: string | null;
  status: string;
  outcome: string | null;
  channel: string;
  customerName: string;
  total: string;
  expiresAt: string | null;
  sentByEmailAt: string | null;
  publishedToPortalAt: string | null;
  createdAt: string;
}

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Todos los estados' },
  { value: 'DRAFT', label: 'Borradores' },
  { value: 'FINAL', label: 'Definitivas' },
];

const CHANNEL_FILTERS = [
  { value: 'ALL', label: 'Todos los canales' },
  { value: 'CORPORATE', label: 'Corporativo' },
  { value: 'RETAIL', label: 'Individual' },
];

export default function AdminQuotesPage() {
  const [quotes, setQuotes] = useState<AdminQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount = countActiveFilters([statusFilter, channelFilter]);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (channelFilter !== 'ALL') params.set('channel', channelFilter);
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/admin/quotes?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setQuotes(data.quotes);
    } catch {
      toast.error('Error al cargar cotizaciones');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, channelFilter, search]);

  useEffect(() => {
    const timeout = setTimeout(fetchQuotes, 250);
    return () => clearTimeout(timeout);
  }, [fetchQuotes]);

  const statusFilterSelect = (
    <Select value={statusFilter} onValueChange={setStatusFilter}>
      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
      <SelectContent>
        {STATUS_FILTERS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const channelFilterSelect = (
    <Select value={channelFilter} onValueChange={setChannelFilter}>
      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
      <SelectContent>
        {CHANNEL_FILTERS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-[#111111]">Cotizaciones</h1>
          <p className="text-sm text-gray-500 mt-1">Cotizaciones corporativas e individuales</p>
        </div>
        <Link href="/admin/cotizaciones/nueva">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Nueva cotización
          </Button>
        </Link>
      </div>

      {/* Filtros desktop */}
      <div className="hidden md:flex gap-3 mb-4 flex-wrap">
        <Input
          placeholder="Buscar por cliente o número..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        {statusFilterSelect}
        {channelFilterSelect}
      </div>

      {/* Filtros mobile: buscador siempre visible + Drawer "Filtros" para status/canal */}
      <div className="md:hidden flex flex-col gap-2 mb-4">
        <Input
          placeholder="Buscar por cliente o número..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full min-h-11"
        />
        <Button
          variant="outline"
          className="min-h-11 justify-between"
          onClick={() => setFiltersOpen(true)}
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
          </span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary">{activeFilterCount}</Badge>
          )}
        </Button>
      </div>

      <ResponsiveDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title="Filtros"
        footer={
          <Button className="w-full min-h-11" onClick={() => setFiltersOpen(false)}>
            Ver resultados
          </Button>
        }
      >
        <div className="flex flex-col gap-4 py-2">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-gray-700">Estado</p>
            {statusFilterSelect}
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-gray-700">Canal</p>
            {channelFilterSelect}
          </div>
        </div>
      </ResponsiveDialog>

      {/* Vista tabla (desktop) */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : quotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    Aún no hay cotizaciones
                  </TableCell>
                </TableRow>
              ) : (
                quotes.map((q) => {
                  const statusInfo = QUOTE_STATUS_LABELS[q.status] || { label: q.status, variant: 'secondary' as const };
                  const outcomeInfo = q.outcome ? QUOTE_OUTCOME_LABELS[q.outcome] : null;
                  return (
                    <TableRow key={q.id}>
                      <TableCell>
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">{q.quoteNumber ?? 'Borrador'}</code>
                      </TableCell>
                      <TableCell className="font-medium">{q.customerName}</TableCell>
                      <TableCell>{QUOTE_CHANNEL_LABELS[q.channel] ?? q.channel}</TableCell>
                      <TableCell>${Number(q.total).toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant={outcomeInfo?.variant ?? statusInfo.variant}>
                            {outcomeInfo?.label ?? statusInfo.label}
                          </Badge>
                          {isQuoteExpired(q) && <Badge variant="destructive">Vencida</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {q.sentByEmailAt && <Mail className="w-4 h-4 text-gray-400" aria-label="Enviada por correo" />}
                          {q.publishedToPortalAt && <Globe className="w-4 h-4 text-gray-400" aria-label="Publicada en portal" />}
                        </div>
                      </TableCell>
                      <TableCell>{new Date(q.createdAt).toLocaleDateString('es-EC')}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/admin/cotizaciones/${q.id}`}>
                          <Button size="sm" variant="ghost"><Eye className="w-4 h-4" /></Button>
                        </Link>
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
        ) : quotes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="mb-4">Aún no hay cotizaciones</p>
            <Link href="/admin/cotizaciones/nueva">
              <Button className="gap-2 min-h-11">
                <Plus className="w-4 h-4" />
                Nueva cotización
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {quotes.map((q) => {
              const statusInfo = QUOTE_STATUS_LABELS[q.status] || { label: q.status, variant: 'secondary' as const };
              const outcomeInfo = q.outcome ? QUOTE_OUTCOME_LABELS[q.outcome] : null;
              return (
                <AdminListCard
                  key={q.id}
                  href={`/admin/cotizaciones/${q.id}`}
                  aria-label={`Ver cotización de ${q.customerName}`}
                  title={q.customerName}
                  subtitle={`${q.quoteNumber ?? 'Borrador'} · ${new Date(q.createdAt).toLocaleDateString('es-EC')}`}
                  badges={
                    <>
                      <Badge variant={outcomeInfo?.variant ?? statusInfo.variant}>
                        {outcomeInfo?.label ?? statusInfo.label}
                      </Badge>
                      {isQuoteExpired(q) && <Badge variant="destructive">Vencida</Badge>}
                    </>
                  }
                  meta={
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{QUOTE_CHANNEL_LABELS[q.channel] ?? q.channel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-[#111111]">${Number(q.total).toFixed(2)}</span>
                      {q.sentByEmailAt && <Mail className="w-3.5 h-3.5 text-gray-400" aria-label="Enviada por correo" />}
                      {q.publishedToPortalAt && <Globe className="w-3.5 h-3.5 text-gray-400" aria-label="Publicada en portal" />}
                    </div>
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
