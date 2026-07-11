'use client';

import { useState, useCallback } from 'react';
import { resizeAndCompressImage, sha256Hex } from '@/lib/client-image-utils';
import { extractVideoMetadata } from '@/lib/client-video-utils';
import type { MediaAssetSummary } from '@/lib/media';

/** El endpoint /confirm devuelve la fila completa de media_assets. */
export type MediaUploadResult = MediaAssetSummary;

interface UploadState {
  fileName: string;
  progress: number; // 0-100, ponderado por etapa
  status: 'pending' | 'processing' | 'uploading' | 'confirming' | 'done' | 'error';
  error?: string;
  loadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  etaSeconds: number;
}

const INITIAL_UPLOAD_STATE: Omit<UploadState, 'fileName'> = {
  progress: 0,
  status: 'pending',
  loadedBytes: 0,
  totalBytes: 0,
  speedBytesPerSec: 0,
  etaSeconds: 0,
};

/** Sube un blob a una URL prefirmada de R2 vía XHR (fetch no expone progreso de subida). */
function putWithProgress(
  url: string,
  blob: Blob,
  mimeType: string,
  onProgress: (loaded: number, total: number, speedBytesPerSec: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', mimeType);

    let lastTime = performance.now();
    let lastLoaded = 0;
    let smoothedSpeed = 0;

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      const dBytes = e.loaded - lastLoaded;
      if (dt > 0.05) {
        const instantSpeed = dBytes / dt;
        // Media móvil exponencial para suavizar picos de la red.
        smoothedSpeed = smoothedSpeed === 0 ? instantSpeed : smoothedSpeed * 0.7 + instantSpeed * 0.3;
        lastTime = now;
        lastLoaded = e.loaded;
      }
      onProgress(e.loaded, e.total, smoothedSpeed);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Falló la subida a R2 (status ${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Falló la subida a R2'));
    xhr.onabort = () => reject(new Error('Subida cancelada'));

    xhr.send(blob);
  });
}

export function useMediaUpload() {
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});

  const uploadFile = useCallback(async (
    file: File,
    folder: string,
    segments: string[] = []
  ): Promise<MediaUploadResult> => {
    const key = `${file.name}-${Date.now()}`;
    setUploads((prev) => ({ ...prev, [key]: { fileName: file.name, ...INITIAL_UPLOAD_STATE, status: 'processing' } }));

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
      setUploads((prev) => ({ ...prev, [key]: { ...prev[key], progress: 5, status: 'uploading', totalBytes: blob.size } }));

      const mimeType = blob.type || file.type;
      const presignRes = await fetch('/api/admin/media/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder, fileName: file.name, mimeType, sizeBytes: blob.size, segments }),
      });
      if (!presignRes.ok) throw new Error((await presignRes.json()).error || 'No se pudo generar la URL de subida');
      const { url, key: storageKey } = await presignRes.json();

      await putWithProgress(url, blob, mimeType, (loaded, total, speedBytesPerSec) => {
        const uploadPct = total > 0 ? loaded / total : 0;
        const remaining = total - loaded;
        const etaSeconds = speedBytesPerSec > 0 ? remaining / speedBytesPerSec : 0;
        setUploads((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            progress: 5 + uploadPct * 90,
            loadedBytes: loaded,
            totalBytes: total,
            speedBytesPerSec,
            etaSeconds,
          },
        }));
      });

      setUploads((prev) => ({ ...prev, [key]: { ...prev[key], progress: 95, status: 'confirming', speedBytesPerSec: 0, etaSeconds: 0 } }));

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
