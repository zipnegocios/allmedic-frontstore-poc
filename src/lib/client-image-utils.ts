'use client';

const MAX_DIMENSION = 2400;
const JPEG_QUALITY = 0.85;

/** Redimensiona (máx. 2400px lado mayor) y comprime una imagen en el navegador antes de subirla. */
export async function resizeAndCompressImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo obtener el contexto de canvas');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, JPEG_QUALITY));
  if (!blob) throw new Error('No se pudo comprimir la imagen');

  return { blob, width, height };
}

/** Calcula el checksum SHA-256 de un blob (idempotencia de subidas duplicadas). */
export async function sha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
