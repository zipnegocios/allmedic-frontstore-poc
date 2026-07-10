'use client';

/** Extrae dimensiones y duración de un video en el navegador, sin recodificarlo. */
export async function extractVideoMetadata(file: File): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => {
      const { videoWidth, videoHeight, duration } = video;
      URL.revokeObjectURL(url);
      resolve({ width: videoWidth, height: videoHeight, duration: Math.round(duration) });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer el video (formato no soportado o archivo corrupto)'));
    };
  });
}
