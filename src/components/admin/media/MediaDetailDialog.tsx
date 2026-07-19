'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import Image from 'next/image';
import { ResponsiveDialog } from '@/components/admin/ResponsiveDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { Trash2, Save, AlertTriangle, Link2, Link2Off, Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { resolveMediaUrl, isVideoMime, MEDIA_ENTITY_TYPES } from '@/lib/media';
import { VideoPreviewRangeEditor } from './VideoPreviewRangeEditor';
import { toast } from 'sonner';

const ROLE_OPTIONS_BY_ENTITY: Record<string, { value: string; label: string }[]> = {
  PRODUCT: [
    { value: 'GALLERY', label: 'Galería (por color)' },
    { value: 'COVER', label: 'Portada primaria' },
    { value: 'COVER_SECONDARY', label: 'Portada secundaria' },
  ],
  SET: [{ value: 'COVER', label: 'Portada' }],
  BRAND: [{ value: 'LOGO', label: 'Logo' }],
  BANNER: [
    { value: 'DESKTOP', label: 'Imagen desktop' },
    { value: 'MOBILE', label: 'Imagen mobile' },
  ],
};

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
    durationSeconds: number | null;
    previewStartSeconds: number | null;
    previewDurationSeconds: number | null;
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
  const isMobile = useIsMobile();
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fileName, setFileName] = useState('');
  const [altText, setAltText] = useState('');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ─── Gestión de vínculos: desvincular + asignar/reciclar a otra entidad ───
  const [unlinkTarget, setUnlinkTarget] = useState<MediaLinkUsage | null>(null);
  const [unlinking, setUnlinking] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEntityType, setAssignEntityType] = useState<string>('PRODUCT');
  const [assignEntityId, setAssignEntityId] = useState('');
  const [assignRole, setAssignRole] = useState('GALLERY');
  const [assignColorId, setAssignColorId] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);
  const [productOptions, setProductOptions] = useState<{ id: string; name: string; brandName: string }[]>([]);
  const [setOptions, setSetOptions] = useState<{ id: string; name: string }[]>([]);
  const [brandOptions, setBrandOptions] = useState<{ id: string; name: string }[]>([]);
  const [bannerOptions, setBannerOptions] = useState<{ id: string; title: string }[]>([]);
  const [productColors, setProductColors] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!assignOpen) return;
    // Listas livianas para el selector — se cargan una sola vez al abrir el panel.
    if (productOptions.length === 0) {
      fetch('/api/admin/products/lite').then((r) => r.json()).then((d) => setProductOptions(d.products ?? [])).catch(() => {});
    }
    if (setOptions.length === 0) {
      fetch('/api/admin/sets').then((r) => r.json()).then((d) => setSetOptions(d.sets ?? [])).catch(() => {});
    }
    if (brandOptions.length === 0) {
      fetch('/api/admin/brands?limit=200').then((r) => r.json()).then((d) => setBrandOptions(d.brands ?? [])).catch(() => {});
    }
    if (bannerOptions.length === 0) {
      fetch('/api/admin/banners?limit=200').then((r) => r.json()).then((d) => setBannerOptions(d.banners ?? [])).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignOpen]);

  useEffect(() => {
    setAssignColorId('');
    setProductColors([]);
    if (assignEntityType !== 'PRODUCT' || !assignEntityId || assignRole !== 'GALLERY') return;
    fetch(`/api/admin/products/${assignEntityId}`)
      .then((r) => r.json())
      .then((product) => {
        const seen = new Map<string, string>();
        for (const v of product.variants ?? []) {
          if (v.colorId && !seen.has(v.colorId)) seen.set(v.colorId, v.colorName ?? v.colorId);
        }
        setProductColors(Array.from(seen, ([id, name]) => ({ id, name })));
      })
      .catch(() => setProductColors([]));
  }, [assignEntityType, assignEntityId, assignRole]);

  async function handleUnlink() {
    if (!unlinkTarget) return;
    setUnlinking(true);
    try {
      const res = await fetch(`/api/admin/media/links/${unlinkTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'No se pudo desvincular');
      toast.success('Vínculo eliminado');
      setUnlinkTarget(null);
      await fetchDetail();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al desvincular');
    } finally {
      setUnlinking(false);
    }
  }

  async function handleAssign() {
    if (!assetId || !assignEntityId) return;
    setAssignSaving(true);
    try {
      const res = await fetch('/api/admin/media/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          entityType: assignEntityType,
          entityId: assignEntityId,
          role: assignRole,
          colorId: assignEntityType === 'PRODUCT' && assignRole === 'GALLERY' && assignColorId ? assignColorId : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'No se pudo asignar');
      toast.success('Medio asignado');
      setAssignOpen(false);
      setAssignEntityId('');
      await fetchDetail();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al asignar');
    } finally {
      setAssignSaving(false);
    }
  }

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

  const previewBlock = detail && (
    <div>
      <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-50 mb-4">
        {isVideoMime(detail.asset.mimeType) ? (
          <video
            src={resolveMediaUrl(detail.asset.storageKey)}
            controls
            playsInline
            className="w-full h-full object-contain"
          />
        ) : (
          <Image src={resolveMediaUrl(detail.asset.storageKey)} alt={detail.asset.altText ?? ''} fill className="object-contain" />
        )}
      </div>
      <div className="text-sm text-gray-500 space-y-1">
        <p><strong>Dimensiones:</strong> {detail.asset.width ?? '?'} × {detail.asset.height ?? '?'}px</p>
        {isVideoMime(detail.asset.mimeType) && (
          <p><strong>Duración:</strong> {detail.asset.durationSeconds != null ? `${detail.asset.durationSeconds}s` : '?'}</p>
        )}
        <p><strong>Peso:</strong> {(detail.asset.sizeBytes / 1024).toFixed(1)} KB</p>
        <p><strong>Formato:</strong> {detail.asset.mimeType}</p>
        <p><strong>Carpeta:</strong> {detail.asset.folder}</p>
        <p><strong>Ruta:</strong> <code className="text-xs">{detail.asset.storageKey}</code></p>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold">Usos relacionados</h4>
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAssignOpen((v) => !v)}>
            <Plus className="w-3 h-3 mr-1" /> Asignar
          </Button>
        </div>
        {detail.links.length === 0 ? (
          <p className="text-sm text-gray-400">Sin usos — puede eliminarse libremente</p>
        ) : (
          <ul className="space-y-1.5">
            {detail.links.map((link) => (
              <li key={link.id} className="flex items-center justify-between gap-2 text-sm bg-gray-50 rounded px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <Badge variant="outline" className="mr-2">{ENTITY_LABELS[link.entityType] ?? link.entityType}</Badge>
                  <span className="truncate">{link.entityName ?? link.entityId}</span> <span className="text-gray-400">({link.role})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setUnlinkTarget(link)}
                  className="text-gray-400 hover:text-red-600 flex-shrink-0"
                  title="Desvincular"
                >
                  <Link2Off className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {unlinkTarget && (
          <div className="mt-2 border border-red-200 bg-red-50 rounded-lg p-3">
            <p className="text-sm text-red-700 flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4" />
              ¿Desvincular de {ENTITY_LABELS[unlinkTarget.entityType] ?? unlinkTarget.entityType} &quot;{unlinkTarget.entityName ?? unlinkTarget.entityId}&quot;?
              El medio dejará de mostrarse ahí en el storefront/admin — el asset en sí no se elimina.
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={handleUnlink} disabled={unlinking}>
                {unlinking ? 'Desvinculando...' : 'Desvincular'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setUnlinkTarget(null)}>Cancelar</Button>
            </div>
          </div>
        )}

        {assignOpen && (
          <div className="mt-3 border rounded-lg p-3 space-y-2 bg-white">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium mb-1">Tipo de entidad</label>
                <Select value={assignEntityType} onValueChange={(v) => { setAssignEntityType(v); setAssignEntityId(''); setAssignRole(ROLE_OPTIONS_BY_ENTITY[v]?.[0]?.value ?? 'GALLERY'); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MEDIA_ENTITY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{ENTITY_LABELS[t] ?? t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Rol</label>
                <Select value={assignRole} onValueChange={setAssignRole}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(ROLE_OPTIONS_BY_ENTITY[assignEntityType] ?? []).map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">{ENTITY_LABELS[assignEntityType] ?? 'Entidad'}</label>
              <Select value={assignEntityId} onValueChange={setAssignEntityId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Elegir..." /></SelectTrigger>
                <SelectContent>
                  {assignEntityType === 'PRODUCT' && productOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} {p.brandName ? `— ${p.brandName}` : ''}</SelectItem>
                  ))}
                  {assignEntityType === 'SET' && setOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                  {assignEntityType === 'BRAND' && brandOptions.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                  {assignEntityType === 'BANNER' && bannerOptions.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {assignEntityType === 'PRODUCT' && assignRole === 'GALLERY' && productColors.length > 0 && (
              <div>
                <label className="block text-xs font-medium mb-1">Color (opcional)</label>
                <Select value={assignColorId || '__none__'} onValueChange={(v) => setAssignColorId(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin color específico</SelectItem>
                    {productColors.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="button" size="sm" className="bg-[#111111]" disabled={!assignEntityId || assignSaving} onClick={handleAssign}>
                <Link2 className="w-3.5 h-3.5 mr-1.5" /> {assignSaving ? 'Asignando...' : 'Asignar'}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setAssignOpen(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const metadataBlock = detail && (
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

      {isVideoMime(detail.asset.mimeType) && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold mb-2">Vista previa en tarjetas y grillas</h4>
          <p className="text-xs text-gray-400 mb-2">
            Elige qué fragmento del video se reproduce (mudo, en loop) cuando este medio es la portada de un producto o banner.
          </p>
          <VideoPreviewRangeEditor
            assetId={detail.asset.id}
            videoUrl={resolveMediaUrl(detail.asset.storageKey)}
            durationSeconds={detail.asset.durationSeconds}
            initialStart={detail.asset.previewStartSeconds}
            initialDuration={detail.asset.previewDurationSeconds}
            onSaved={fetchDetail}
          />
        </div>
      )}
    </div>
  );

  const commentsBlock = detail && (
    <div>
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
  );

  const historyBlock = detail && (
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
  );

  const deleteBlock = (
    <div>
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
  );

  let body: ReactNode = <div className="py-12 text-center text-gray-400">Cargando...</div>;

  if (!loading && detail) {
    body = isMobile ? (
      // Mobile: vista previa siempre visible + resto agrupado en acordeón
      // para evitar scroll infinito dentro del Drawer full-screen.
      <div>
        {previewBlock}
        <Accordion type="multiple" defaultValue={['metadata']} className="mt-2">
          <AccordionItem value="metadata">
            <AccordionTrigger>Metadata</AccordionTrigger>
            <AccordionContent>{metadataBlock}</AccordionContent>
          </AccordionItem>
          <AccordionItem value="comments">
            <AccordionTrigger>Comentarios</AccordionTrigger>
            <AccordionContent>{commentsBlock}</AccordionContent>
          </AccordionItem>
          <AccordionItem value="history">
            <AccordionTrigger>Historial</AccordionTrigger>
            <AccordionContent>{historyBlock}</AccordionContent>
          </AccordionItem>
        </Accordion>
        <div className="mt-6">{deleteBlock}</div>
      </div>
    ) : (
      // Desktop: layout sin cambios (grid de 2 columnas, todo visible).
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {previewBlock}
        <div>
          {metadataBlock}
          <div className="mt-6">
            <h4 className="text-sm font-semibold mb-2">Comentarios</h4>
            {commentsBlock}
          </div>
          <div className="mt-6">
            <h4 className="text-sm font-semibold mb-2">Historial</h4>
            {historyBlock}
          </div>
          <div className="mt-6">{deleteBlock}</div>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveDialog
      open={!!assetId}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Detalle del medio"
      contentClassName="max-w-3xl"
      mobileFullScreen
    >
      {body}
    </ResponsiveDialog>
  );
}
