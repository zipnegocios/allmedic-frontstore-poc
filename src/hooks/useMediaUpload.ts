'use client';

import { useState, useCallback } from 'react';
import { resizeAndCompressImage, sha256Hex } from '@/lib/client-image-utils';
import { extractVideoMetadata } from '@/lib/client-video-utils';
import type { MediaAssetSummary } from '@/lib/media';

/** El endpoint /confirm devuelve la fila completa de media_assets. */
export type MediaUploadResult = MediaAssetSummary;

interface UploadState {
  fileName: string;
  progress: number; // 0-100
  status: 'pending' | 'processing' | 'uploading' | 'confirming' | 'done' | 'error';
  error?: string;
}

export function useMediaUpload() {
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});

  const uploadFile = useCallback(async (
    file: File,
    folder: string,
    segments: string[] = []
  ): Promise<MediaUploadResult> => {
    const key = `${file.name}-${Date.now()}`;
    setUploads((prev) => ({ ...prev, [key]: { fileName: file.name, progress: 0, status: 'processing' } }));

    try {
      const isVideo = file.type.startsWith('video/');
      let blob: Blob;
      let width: number | undefined;
      let height: number | undefined;
      let durationSeconds: number | undefined;

      if (isVideo) {
        blob = file; // sin recodificar — se sube tal cual (sin pipeline de transcodificación)
        const meta = await extractVideoMetadata(file);
        width = meta.width;
        height = meta.height;
        durationSeconds = meta.duration;
      } else {
        const result = await resizeAndCompressImage(file);
        blob = result.blob;
        width = result.width;
        height = result.height;
      }

      const checksum = await sha256Hex(blob);
      setUploads((prev) => ({ ...prev, [key]: { ...prev[key], progress: 20, status: 'uploading' } }));

      const mimeType = blob.type || file.type;
      const presignRes = await fetch('/api/admin/media/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder, fileName: file.name, mimeType, sizeBytes: blob.size, segments }),
      });
      if (!presignRes.ok) throw new Error((await presignRes.json()).error || 'No se pudo generar la URL de subida');
      const { url, key: storageKey } = await presignRes.json();

      const putRes = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body: blob,
      });
      if (!putRes.ok) throw new Error('Falló la subida a R2');
      setUploads((prev) => ({ ...prev, [key]: { ...prev[key], progress: 80, status: 'confirming' } }));

      const confirmRes = await fetch('/api/admin/media/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: storageKey,
          fileName: file.name,
          folder,
          mimeType,
          sizeBytes: blob.size,
          width,
          height,
          checksumSha256: checksum,
          ...(isVideo ? {
            durationSeconds,
            previewStartSeconds: 0,
            previewDurationSeconds: durationSeconds ? Math.min(3, durationSeconds) : 3,
          } : {}),
        }),
      });
      if (!confirmRes.ok) throw new Error((await confirmRes.json()).error || 'No se pudo registrar el medio');
      const asset = await confirmRes.json();

      setUploads((prev) => ({ ...prev, [key]: { ...prev[key], progress: 100, status: 'done' } }));
      return asset;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setUploads((prev) => ({ ...prev, [key]: { ...prev[key], status: 'error', error: message } }));
      throw err;
    }
  }, []);

  const uploadFiles = useCallback(async (
    files: File[],
    folder: string,
    segments: string[] = []
  ): Promise<MediaUploadResult[]> => {
    const results: MediaUploadResult[] = [];
    for (const file of files) {
      results.push(await uploadFile(file, folder, segments));
    }
    return results;
  }, [uploadFile]);

  return { uploads, uploadFile, uploadFiles };
}
