'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

interface EmailLogRow {
  id: string;
  eventKey: string;
  resendId: string | null;
  to: string;
  subject: string;
  status: 'SENT' | 'DELIVERED' | 'BOUNCED' | 'COMPLAINED' | 'OPENED' | 'CLICKED' | 'FAILED';
  sentAt: string;
  lastEventAt: string | null;
}

interface WebhookEventRow {
  id: string;
  resendId: string | null;
  eventType: string;
  payload: unknown;
  receivedAt: string;
}

const STATUS_VARIANT: Record<EmailLogRow['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  SENT: 'secondary',
  DELIVERED: 'default',
  OPENED: 'default',
  CLICKED: 'default',
  BOUNCED: 'destructive',
  FAILED: 'destructive',
  COMPLAINED: 'destructive',
};

const STATUS_LABELS: Record<EmailLogRow['status'], string> = {
  SENT: 'Enviado',
  DELIVERED: 'Entregado',
  OPENED: 'Abierto',
  CLICKED: 'Clic',
  BOUNCED: 'Rebotado',
  FAILED: 'Falló',
  COMPLAINED: 'Reportado como spam',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' });
}

function OutboxTab() {
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch('/api/admin/email-log')
      .then((r) => r.json())
      .then((d) => setRows(d.log ?? []))
      .catch(() => toast.error('Error al cargar el historial de envíos'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Destinatario</TableHead>
                <TableHead>Asunto</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Enviado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-6">Cargando...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-6">Sin correos enviados todavía.</TableCell></TableRow>
              ) : rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-[200px] truncate">{row.to}</TableCell>
                  <TableCell className="max-w-[280px] truncate">{row.subject}</TableCell>
                  <TableCell className="text-xs text-gray-500">{row.eventKey}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABELS[row.status]}</Badge></TableCell>
                  <TableCell className="text-sm text-gray-500 whitespace-nowrap">{formatDate(row.sentAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function InboxTab() {
  const [rows, setRows] = useState<WebhookEventRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch('/api/admin/email-webhook-events')
      .then((r) => r.json())
      .then((d) => setRows(d.events ?? []))
      .catch(() => toast.error('Error al cargar los eventos de webhook'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <p className="text-sm text-gray-500 mb-4">
          Log crudo de los eventos que Resend envía por webhook (entrega, rebote, apertura,
          clic, y el intento de recepción real de correo entrante si se configura a futuro).
        </p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo de evento</TableHead>
                <TableHead>ID de Resend</TableHead>
                <TableHead>Recibido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={3} className="text-center text-gray-500 py-6">Cargando...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-gray-500 py-6">Sin eventos recibidos todavía — requiere configurar el webhook en el dashboard de Resend.</TableCell></TableRow>
              ) : rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm">{row.eventType}</TableCell>
                  <TableCell className="text-xs text-gray-500 max-w-[220px] truncate">{row.resendId ?? '—'}</TableCell>
                  <TableCell className="text-sm text-gray-500 whitespace-nowrap">{formatDate(row.receivedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminCorreosPage() {
  const [tab, setTab] = useState('salida');

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#111111]">Correos</h1>
        <p className="text-sm text-gray-500 mt-1">Bandeja de salida y eventos de entrada de Resend</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="salida">Salida</TabsTrigger>
          <TabsTrigger value="entrada">Entrada / eventos</TabsTrigger>
        </TabsList>
        <TabsContent value="salida" className="mt-6">
          <OutboxTab />
        </TabsContent>
        <TabsContent value="entrada" className="mt-6">
          <InboxTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
