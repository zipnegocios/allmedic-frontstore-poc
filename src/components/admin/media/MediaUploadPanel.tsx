'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { UploadCloud } from 'lucide-react';
import { useMediaUpload, type MediaUploadResult } from '@/hooks/useMediaUpload';
import { MEDIA_FOLDERS, ALLOWED_MEDIA_MIME_TYPES } from '@/lib/media';
import { toast } from 'sonner';

const FOLDER_LABELS: Record<string, string> = {
  PRODUCTS: 'Productos',
  SETS: 'Sets',
  BRANDS: 'Marcas',
  BANNERS: 'Banners',
  SITE: 'Sitio',
};

interface MediaUploadPanelProps {
  folder: string;
  segments?: string[];
  onUploaded: (assets: MediaUploadResult[]) => void;
  showFolderPicker?: boolean;
  onFolderChange?: (folder: string) => void;
}

export function MediaUploadPanel({ folder, segments = [], onUploaded, showFolderPicker, onFolderChange }: MediaUploadPanelProps) {
  const { uploads, uploadFiles } = useMediaUpload();
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).filter((f) => ALLOWED_MEDIA_MIME_TYPES.includes(f.type));
    if (files.length === 0) {
      toast.error('Solo se permiten imágenes JPEG, PNG, WebP o AVIF');
      return;
    }
    setSubmitting(true);
    try {
      const results = await uploadFiles(files, folder, segments);
      toast.success(`${results.length} archivo(s) subido(s)`);
      onUploaded(results);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir archivos');
    } finally {
      setSubmitting(false);
    }
  }

  const uploadList = Object.entries(uploads);

  return (
    <div>
      {showFolderPicker && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Carpeta destino</label>
          <select
            value={folder}
            onChange={(e) => onFolderChange?.(e.target.value)}
            className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm"
          >
            {MEDIA_FOLDERS.map((f) => (
              <option key={f} value={f}>{FOLDER_LABELS[f] ?? f}</option>
            ))}
          </select>
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragActive ? 'border-[#111111] bg-gray-50' : 'border-gray-300'
        }`}
      >
        <UploadCloud className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-500">Arrastra imágenes aquí o haz clic para seleccionar</p>
        <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP o AVIF — máx. 10MB</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_MEDIA_MIME_TYPES.join(',')}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {uploadList.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploadList.map(([key, u]) => (
            <div key={key} className="flex items-center gap-3 text-sm">
              <span className="flex-1 truncate">{u.fileName}</span>
              <Progress value={u.progress} className="w-32" />
              <span className="text-xs text-gray-500 w-20 text-right">
                {u.status === 'error' ? 'Error' : u.status === 'done' ? 'Listo' : 'Subiendo...'}
              </span>
            </div>
          ))}
        </div>
      )}

      {submitting && <p className="text-sm text-gray-500 mt-2">Procesando...</p>}

      <Button type="button" variant="outline" className="mt-4 w-full" onClick={() => inputRef.current?.click()} disabled={submitting}>
        Seleccionar archivos
      </Button>
    </div>
  );
}
