'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Trash2, Save, AlertTriangle } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/media';
import { toast } from 'sonner';

interface MediaLinkUsage {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string | null;
  role: string;
}

interface MediaDetail {
  asset: {
    id: string;
    storageKey: string;
    fileName: string;
    folder: string;
    mimeType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    altText: string | null;
    title: string | null;
    caption: string | null;
    createdAt: string | null;
  };
  tags: { id: string; name: string; slug: string }[];
  links: MediaLinkUsage[];
  comments: { id: string; body: string; createdAt: string | null; userName: string | null }[];
  audit: { id: string; action: string; payload: unknown; createdAt: string | null; userName: string | null }[];
}

const ENTITY_LABELS: Record<string, string> = {
  PRODUCT: 'Producto', SET: 'Set', BRAND: 'Marca', BANNER: 'Banner',
};

interface MediaDetailDialogProps {
  assetId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

export function MediaDetailDialog({ assetId, onClose, onChanged }: MediaDetailDialogProps) {
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fileName, setFileName] = useState('');
  const [altText, setAltText] = useState('');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!assetId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/media/${assetId}`);
      if (!res.ok) throw new Error('No se pudo cargar el medio');
      const data: MediaDetail = await res.json();
      setDetail(data);
      setFileName(data.asset.fileName);
      setAltText(data.asset.altText ?? '');
      setTitle(data.asset.title ?? '');
      setCaption(data.asset.caption ?? '');
    } catch {
      toast.error('Error al cargar el medio');
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  async function handleSave() {
    if (!assetId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/media/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, altText, title, caption }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'No se pudo guardar');
      toast.success('Medio actualizado');
      await fetchDetail();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddComment() {
    if (!assetId || !newComment.trim()) return;
    try {
      const res = await fetch(`/api/admin/media/${assetId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newComment }),
      });
      if (!res.ok) throw new Error('No se pudo agregar el comentario');
      setNewComment('');
      await fetchDetail();
    } catch {
      toast.error('Error al agregar comentario');
    }
  }

  async function handleDelete(force: boolean) {
    if (!assetId) return;
    try {
      const res = await fetch(`/api/admin/media/${assetId}${force ? '?force=true' : ''}`, { method: 'DELETE' });
      if (res.status === 409) {
        setConfirmDelete(true);
        return;
      }
      if (!res.ok) throw new Error((await res.json()).error || 'No se pudo eliminar');
      toast.success('Medio eliminado');
      onChanged?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  return (
    <Dialog open={!!assetId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle del medio</DialogTitle>
        </DialogHeader>

        {loading || !detail ? (
          <div className="py-12 text-center text-gray-400">Cargando...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-50 mb-4">
                <Image src={resolveMediaUrl(detail.asset.storageKey)} alt={detail.asset.altText ?? ''} fill className="object-contain" />
              </div>
              <div className="text-sm text-gray-500 space-y-1">
                <p><strong>Dimensiones:</strong> {detail.asset.width ?? '?'} × {detail.asset.height ?? '?'}px</p>
                <p><strong>Peso:</strong> {(detail.asset.sizeBytes / 1024).toFixed(1)} KB</p>
                <p><strong>Formato:</strong> {detail.asset.mimeType}</p>
                <p><strong>Carpeta:</strong> {detail.asset.folder}</p>
                <p><strong>Ruta:</strong> <code className="text-xs">{detail.asset.storageKey}</code></p>
              </div>

              <div className="mt-4">
                <h4 className="text-sm font-semibold mb-2">Usos relacionados</h4>
                {detail.links.length === 0 ? (
                  <p className="text-sm text-gray-400">Sin usos — puede eliminarse libremente</p>
                ) : (
                  <ul className="space-y-1">
                    {detail.links.map((link) => (
                      <li key={link.id} className="text-sm">
                        <Badge variant="outline" className="mr-2">{ENTITY_LABELS[link.entityType] ?? link.entityType}</Badge>
                        {link.entityName ?? link.entityId} <span className="text-gray-400">({link.role})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Nombre de archivo</label>
                  <Input value={fileName} onChange={(e) => setFileName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Texto alternativo (alt)</label>
                  <Input value={altText} onChange={(e) => setAltText(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Título</label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Descripción (caption)</label>
                  <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full bg-[#111111]">
                  <Save className="w-4 h-4 mr-2" /> {saving ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>

              <div className="mt-6">
                <h4 className="text-sm font-semibold mb-2">Comentarios</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto mb-2">
                  {detail.comments.map((c) => (
                    <div key={c.id} className="text-sm bg-gray-50 rounded p-2">
                      <p>{c.body}</p>
                      <p className="text-xs text-gray-400 mt-1">{c.userName ?? 'Admin'}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Agregar comentario..." />
                  <Button type="button" variant="outline" onClick={handleAddComment}>Enviar</Button>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-sm font-semibold mb-2">Historial</h4>
                <div className="space-y-1 max-h-28 overflow-y-auto text-xs text-gray-500">
                  {detail.audit.length === 0 ? (
                    <p className="text-gray-400">Sin actividad registrada</p>
                  ) : (
                    detail.audit.map((a) => (
                      <p key={a.id}>
                        <strong>{a.action}</strong> — {a.userName ?? 'Sistema'}
                        {a.createdAt ? ` · ${new Date(a.createdAt).toLocaleString('es-EC')}` : ''}
                      </p>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-6">
                {confirmDelete ? (
                  <div className="border border-red-200 bg-red-50 rounded-lg p-3">
                    <p className="text-sm text-red-700 flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4" /> Este medio está en uso. ¿Eliminar de todas formas y desvincular?
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(true)}>Eliminar y desvincular</Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="destructive" onClick={() => handleDelete(false)} className="w-full">
                    <Trash2 className="w-4 h-4 mr-2" /> Eliminar medio
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
