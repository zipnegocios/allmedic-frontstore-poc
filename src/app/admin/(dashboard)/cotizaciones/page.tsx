'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { QUOTE_STATUS_LABELS } from '@/lib/quote-status';

interface AdminQuote {
  id: string;
  code: string;
  customerData: { razonSocial?: string; contactName?: string; city?: string };
  referenceSubtotal: string;
  quotedTotal: string | null;
  status: string;
  createdAt: string;
}

export default function AdminQuotesPage() {
  const [quotes, setQuotes] = useState<AdminQuote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/quotes');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setQuotes(data.quotes);
    } catch {
      toast.error('Error al cargar solicitudes de cotización');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#111111]">Cotizaciones</h1>
        <p className="text-sm text-gray-500 mt-1">Solicitudes de cotización del catálogo corporativo</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Total Referencial</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : quotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    No hay solicitudes de cotización todavía
                  </TableCell>
                </TableRow>
              ) : (
                quotes.map((q) => {
                  const statusInfo = QUOTE_STATUS_LABELS[q.status] || { label: q.status, variant: 'secondary' as const };
                  return (
                    <TableRow key={q.id}>
                      <TableCell><code className="text-sm bg-gray-100 px-2 py-1 rounded">{q.code}</code></TableCell>
                      <TableCell>
                        <div className="font-medium">{q.customerData?.razonSocial || '-'}</div>
                        <div className="text-xs text-gray-500">{q.customerData?.contactName}</div>
                      </TableCell>
                      <TableCell>{new Date(q.createdAt).toLocaleDateString('es-EC')}</TableCell>
                      <TableCell>${Number(q.quotedTotal ?? q.referenceSubtotal).toFixed(2)}</TableCell>
                      <TableCell><Badge variant={statusInfo.variant}>{statusInfo.label}</Badge></TableCell>
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
    </div>
  );
}
