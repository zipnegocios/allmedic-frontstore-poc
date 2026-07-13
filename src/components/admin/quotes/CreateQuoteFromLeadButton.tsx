'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';

export function CreateQuoteFromLeadButton({ leadId, disabled }: { leadId: string; disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/create-quote`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      router.push(`/admin/cotizaciones/${data.id}`);
    } catch {
      toast.error('Error al crear la cotización');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleClick} disabled={disabled || loading} className="gap-2">
      <FileText className="w-4 h-4" />
      {loading ? 'Creando...' : 'Crear cotización'}
    </Button>
  );
}
