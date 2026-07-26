'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { AdminListCard } from '@/components/admin/AdminListCard';

interface EmailEventSetting {
  id: string;
  eventKey: string;
  label: string;
  enabled: boolean;
}

export function EmailEventsPanel() {
  const [events, setEvents] = useState<EmailEventSetting[]>([]);
  const [testEmails, setTestEmails] = useState<Record<string, string>>({});
  const [testingKey, setTestingKey] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/admin/email-events')
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .catch(() => toast.error('Error al cargar eventos de correo'));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleEnabled(event: EmailEventSetting) {
    const nextEnabled = !event.enabled;
    setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, enabled: nextEnabled } : e)));
    const res = await fetch(`/api/admin/email-events/${event.eventKey}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: nextEnabled }),
    });
    if (!res.ok) {
      toast.error('Error al actualizar el evento');
      load();
    }
  }

  async function sendTest(event: EmailEventSetting) {
    const to = testEmails[event.eventKey]?.trim();
    if (!to) {
      toast.error('Escribe un correo de destino para la prueba');
      return;
    }
    setTestingKey(event.eventKey);
    try {
      const res = await fetch(`/api/admin/email-events/${event.eventKey}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? 'Error al enviar el correo de prueba');
        return;
      }
      toast.success(`Correo de prueba enviado a ${to}`);
    } finally {
      setTestingKey(null);
    }
  }

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <h2 className="font-semibold mb-1">Eventos de correo</h2>
        <p className="text-sm text-gray-500 mb-4">
          Activa o desactiva individualmente cada correo automático que envía el sistema, o
          envía una prueba con datos de ejemplo al correo que quieras.
        </p>

        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead className="w-24 text-center">Activo</TableHead>
                <TableHead className="w-80">Probar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-gray-500 py-6">Cargando eventos...</TableCell></TableRow>
              ) : events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{event.label}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={event.enabled} onCheckedChange={() => toggleEnabled(event)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        type="email"
                        placeholder="correo@ejemplo.com"
                        value={testEmails[event.eventKey] ?? ''}
                        onChange={(e) => setTestEmails((prev) => ({ ...prev, [event.eventKey]: e.target.value }))}
                        className="h-9"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 shrink-0"
                        disabled={testingKey === event.eventKey}
                        onClick={() => sendTest(event)}
                      >
                        <Send className="w-3.5 h-3.5" />
                        Probar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="md:hidden flex flex-col gap-3">
          {events.map((event) => (
            <AdminListCard
              key={event.id}
              title={event.label}
              inlineControl={
                <div className="flex items-center gap-2">
                  <Switch checked={event.enabled} onCheckedChange={() => toggleEnabled(event)} />
                  <span className="text-xs text-gray-500">{event.enabled ? 'Activo' : 'Inactivo'}</span>
                </div>
              }
              meta={
                <div
                  className="flex items-center gap-2 pt-1"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <Input
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={testEmails[event.eventKey] ?? ''}
                    onChange={(e) => setTestEmails((prev) => ({ ...prev, [event.eventKey]: e.target.value }))}
                    className="h-11"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 shrink-0 min-h-11"
                    disabled={testingKey === event.eventKey}
                    onClick={() => sendTest(event)}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Probar
                  </Button>
                </div>
              }
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
