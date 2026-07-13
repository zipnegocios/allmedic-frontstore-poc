export const QUOTE_STATUS_LABELS: Record<string, { label: string; variant: 'outline' | 'secondary' | 'destructive' }> = {
  DRAFT: { label: 'Borrador', variant: 'secondary' },
  FINAL: { label: 'Definitiva', variant: 'outline' },
};

export const QUOTE_OUTCOME_LABELS: Record<string, { label: string; variant: 'outline' | 'secondary' | 'destructive' }> = {
  ACCEPTED: { label: 'Aceptada', variant: 'outline' },
  REJECTED: { label: 'Rechazada', variant: 'destructive' },
};

export const QUOTE_CHANNEL_LABELS: Record<string, string> = {
  CORPORATE: 'Corporativo',
  RETAIL: 'Individual',
};
