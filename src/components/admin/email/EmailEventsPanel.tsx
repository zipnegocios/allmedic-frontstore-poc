'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <h2 className="font-semibold mb-1">Eventos de correo</h2>
        <p className="text-sm text-gray-500 mb-4">
          Activa o desactiva individualmente cada correo automático que envía el sistema.
        </p>

        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead className="w-24 text-right">Activo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center text-gray-500 py-6">Cargando eventos...</TableCell></TableRow>
              ) : events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{event.label}</TableCell>
                  <TableCell className="text-right">
                    <Switch checked={event.enabled} onCheckedChange={() => toggleEnabled(event)} />
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
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
