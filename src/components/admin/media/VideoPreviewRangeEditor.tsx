'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import { toast } from 'sonner';
import { MAX_VIDEO_PREVIEW_DURATION_SECONDS } from '@/lib/media';

interface VideoPreviewRangeEditorProps {
  assetId: string;
  videoUrl: string;
  durationSeconds: number | null;
  initialStart: number | null;
  initialDuration: number | null;
  onSaved?: () => void;
}

/** Scrubber para elegir el clip (inicio + duración) que se reproduce en tarjetas/grillas. No recorta el archivo. */
export function VideoPreviewRangeEditor({ assetId, videoUrl, durationSeconds, initialStart, initialDuration, onSaved }: VideoPreviewRangeEditorProps) {
  const total = durationSeconds ?? 0;
  const [start, setStart] = useState(initialStart ?? 0);
  const [duration, setDuration] = useState(initialDuration ?? 3);
  const [saving, setSaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const maxStart = Math.max(0, total - 1);
  const maxDuration = Math.min(MAX_VIDEO_PREVIEW_DURATION_SECONDS, Math.max(1, total - start));

  useEffect(() => {
    if (duration > maxDuration) setDuration(maxDuration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, total]);

  function playPreview() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = start;
    video.play().catch(() => {});
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    if (video.currentTime >= start + duration) {
      video.currentTime = start;
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/media/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previewStartSeconds: Math.round(start), previewDurationSeconds: Math.round(duration) }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'No se pudo guardar la ventana de vista previa');
      toast.success('Vista previa actualizada');
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  if (!total) {
    return <p className="text-sm text-gray-400">Duración desconocida — no se puede configurar la vista previa.</p>;
  }

  return (
    <div className="space-y-3">
      <video
        ref={videoRef}
        src={videoUrl}
        muted
        playsInline
        className="w-full rounded-lg bg-black aspect-video object-contain"
        onTimeUpdate={handleTimeUpdate}
      />

      <div>
        <label className="flex justify-between text-xs font-medium mb-1">
          <span>Inicio</span>
          <span>{start}s</span>
        </label>
        <input
          type="range"
          min={0}
          max={maxStart}
          step={1}
          value={start}
          onChange={(e) => setStart(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div>
        <label className="flex justify-between text-xs font-medium mb-1">
          <span>Duración del clip</span>
          <span>{duration}s</span>
        </label>
        <input
          type="range"
          min={1}
          max={maxDuration}
          step={1}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={playPreview}>
          <Play className="w-3.5 h-3.5 mr-1" /> Vista previa
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={saving} className="bg-[#111111]">
          {saving ? 'Guardando...' : 'Guardar ventana'}
        </Button>
      </div>
    </div>
  );
}
