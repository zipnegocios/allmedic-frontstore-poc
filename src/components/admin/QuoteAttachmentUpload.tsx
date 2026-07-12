'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { UploadCloud } from 'lucide-react';

const ATTACHMENT_TYPE_LABELS: Record<string, string> = {
  COTIZACION: 'Cotización',
  FACTURA: 'Factura',
  NOTA_ENTREGA: 'Nota de Entrega',
  OTRO: 'Otro',
};

export function QuoteAttachmentUpload({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState('COTIZACION');
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Solo se aceptan archivos PDF');
      return;
    }

    setUploading(true);
    try {
      const presignRes = await fetch(`/api/admin/quotes/${quoteId}/attachments/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, sizeBytes: file.size }),
      });
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}));
        throw new Error(err.error || 'No se pudo iniciar la subida');
      }
      const { uploadUrl, key } = await presignRes.json();

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      });
      if (!putRes.ok) throw new Error('Falló la subida del archivo a almacenamiento');

      const confirmRes = await fetch(`/api/admin/quotes/${quoteId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, fileName: file.name, type }),
      });
      if (!confirmRes.ok) throw new Error('No se pudo registrar el adjunto');

      toast.success('Adjunto subido correctamente');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir el adjunto');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={type} onValueChange={setType}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(ATTACHMENT_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant="outline"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <UploadCloud className="w-4 h-4 mr-2" />
        {uploading ? 'Subiendo...' : 'Subir PDF'}
      </Button>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
