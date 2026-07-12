export const QUOTE_STATUS_LABELS: Record<string, { label: string; variant: 'outline' | 'secondary' | 'destructive' }> = {
  RECEIVED: { label: 'Recibida', variant: 'secondary' },
  IN_REVIEW: { label: 'En revisión', variant: 'outline' },
  QUOTED: { label: 'Cotizada', variant: 'outline' },
  SENT: { label: 'Enviada', variant: 'outline' },
  APPROVED: { label: 'Aprobada', variant: 'outline' },
  REJECTED: { label: 'Rechazada', variant: 'destructive' },
  CLOSED: { label: 'Cerrada', variant: 'secondary' },
};

export const QUOTE_STATUS_ORDER = ['RECEIVED', 'IN_REVIEW', 'QUOTED', 'SENT', 'APPROVED', 'REJECTED', 'CLOSED'] as const;
