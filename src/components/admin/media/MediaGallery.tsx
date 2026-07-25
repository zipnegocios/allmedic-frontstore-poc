'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronLeft, ChevronRight, ImageOff, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MEDIA_FOLDERS, type MediaAssetSummary } from '@/lib/media';
import { MediaThumb } from './MediaThumb';

const FOLDER_LABELS: Record<string, string> = {
  PRODUCTS: 'Productos',
  SETS: 'Sets',
  BRANDS: 'Marcas',
  BANNERS: 'Banners',
  SITE: 'Sitio',
  SWATCHES: 'Muestras',
};

interface MediaGalleryProps {
  folder?: string;
  selectable?: boolean;
  multiple?: boolean;
  selectedIds?: string[];
  onSelect?: (asset: MediaAssetSummary) => void;
  onAssetClick?: (asset: MediaAssetSummary) => void;
  refreshKey?: number;
  mediaType?: 'image' | 'video' | 'all';
  /** Picker enfocado: restringe (+ etiqueta) el listado a la carpeta física de
   * una entidad puntual — ver `buildProductMediaKey`. Sin esto, comportamiento
   * de biblioteca completa sin cambios. */
  keyPrefix?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  /** Acota el término "vinculado" de `linkedEntityType`/`linkedEntityId` a un
   * color puntual — sin esto, ese término trae vínculos de TODOS los colores
   * del producto. `null` = portada del producto; string = galería de ese
   * color; `undefined` (default) = sin acotar. Ver `listMediaAssets`. */
  linkedColorId?: string | null;
  /** Nodo seleccionado del árbol de biblioteca (Fase 5) — filtra por lo
   * vinculado a esa marca/colección/producto/color en vez de por carpeta. */
  treeNode?: { type: 'brand' | 'collection' | 'product' | 'color'; id: string; productId?: string } | null;
  /** Portadas de set en modo "Portadas del contenido": filtra por lo vinculado
   * a cualquiera de estos productos (galerías de las piezas del set, en
   * memoria — no depende de que el set ya esté guardado). */
  productIds?: string[];
  /** Oculta la fila interna de búsqueda/filtros — para consumidores (ej.
   * `MediaPicker`) que renderizan esos controles en su propio layout,
   * pasando el estado por las props controladas de abajo. Sin esto,
   * comportamiento de biblioteca completa sin cambios. */
  hideFilters?: boolean;
  /** Estado de filtros controlado desde afuera (junto con sus `on*Change`).
   * Si no vienen, `MediaGallery` mantiene su propio estado interno — no
   * rompe consumidores existentes como `/admin/biblioteca`. */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  folderValue?: string;
  onFolderChange?: (value: string) => void;
  mediaTypeValue?: 'image' | 'video' | 'all';
  onMediaTypeChange?: (value: 'image' | 'video' | 'all') => void;
  unusedValue?: boolean;
  onUnusedChange?: (value: boolean) => void;
}

export function MediaGallery({
  folder: fixedFolder,
  selectable = false,
  multiple = false,
  selectedIds = [],
  onSelect,
  onAssetClick,
  refreshKey = 0,
  mediaType: fixedMediaType,
  keyPrefix,
  linkedEntityType,
  linkedEntityId,
  linkedColorId,
  treeNode,
  productIds,
  hideFilters = false,
  searchValue,
  onSearchChange,
  folderValue,
  onFolderChange,
  mediaTypeValue,
  onMediaTypeChange,
  unusedValue,
  onUnusedChange,
}: MediaGalleryProps) {
  const [assets, setAssets] = useState<MediaAssetSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [qInternal, setQInternal] = useState('');
  const [folderInternal, setFolderInternal] = useState(fixedFolder ?? 'all');
  const [mediaTypeInternal, setMediaTypeInternal] = useState(fixedMediaType ?? 'all');
  const [unusedInternal, setUnusedInternal] = useState(false);
  const [loading, setLoading] = useState(true);
  const limit = 40;

  // Controlado desde afuera si el consumidor pasó `*Value`+`on*Change` (ej.
  // `MediaPicker` con `hideFilters`); si no, cae al estado interno de siempre.
  const q = searchValue ?? qInternal;
  const setQ = onSearchChange ?? setQInternal;
  const folder = folderValue ?? folderInternal;
  const setFolder = onFolderChange ?? setFolderInternal;
  const mediaType = mediaTypeValue ?? mediaTypeInternal;
  const setMediaType = onMediaTypeChange ?? setMediaTypeInternal;
  const unused = unusedValue ?? unusedInternal;
  const setUnused = onUnusedChange ?? setUnusedInternal;

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fixedFolder) params.set('folder', fixedFolder);
      else if (folder !== 'all') params.set('folder', folder);
      const effectiveMediaType = fixedMediaType ?? mediaType;
      if (effectiveMediaType !== 'all') params.set('mediaType', effectiveMediaType);
      if (q) params.set('q', q);
      if (unused) params.set('unused', 'true');
      if (keyPrefix) {
        params.set('keyPrefix', keyPrefix);
        if (linkedEntityType) params.set('linkedEntityType', linkedEntityType);
        if (linkedEntityId) params.set('linkedEntityId', linkedEntityId);
        if (linkedColorId !== undefined) params.set('linkedColorId', linkedColorId === null ? '__COVER__' : linkedColorId);
      }
      if (treeNode) {
        params.set('treeNodeType', treeNode.type);
        // Para nodos de color, `media_links` se filtra por producto+colorId — el
        // id del nodo de color es el color en sí, así que el id "de entidad" a
        // resolver es el producto al que pertenece.
        params.set('treeNodeId', treeNode.type === 'color' ? (treeNode.productId ?? treeNode.id) : treeNode.id);
        if (treeNode.type === 'color') params.set('treeNodeColorId', treeNode.id);
      }
      if (productIds && productIds.length > 0) params.set('productIds', productIds.join(','));
      params.set('page', String(page));
      params.set('limit', String(limit));

      const res = await fetch(`/api/admin/media?${params}`);
      if (!res.ok) throw new Error('Failed to fetch media');
      const data = await res.json();
      setAssets(data.assets);
      setTotal(data.total);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [fixedFolder, folder, fixedMediaType, mediaType, q, unused, page, keyPrefix, linkedEntityType, linkedEntityId, linkedColorId, treeNode, productIds]);

  useEffect(() => { fetchAssets(); }, [fetchAssets, refreshKey]);
  // Volver a la página 1 al cambiar de nodo del árbol o de filtros — evita
  // quedar en una página fuera de rango del nuevo resultado filtrado. Cubre
  // tanto el estado interno como el controlado desde afuera (`MediaPicker`).
  useEffect(() => { setPage(1); }, [treeNode?.type, treeNode?.id, q, folder, mediaType, unused]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      {!hideFilters && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre, alt o título..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              className="pl-10"
            />
          </div>
          {!fixedFolder && (
            <Select value={folder} onValueChange={(v) => { setFolder(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Carpeta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las carpetas</SelectItem>
                {MEDIA_FOLDERS.map((f) => (
                  <SelectItem key={f} value={f}>{FOLDER_LABELS[f] ?? f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {!fixedMediaType && (
            <Select value={mediaType} onValueChange={(v) => { setMediaType(v as 'image' | 'video' | 'all'); setPage(1); }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Fotos y videos</SelectItem>
                <SelectItem value="image">Solo fotos</SelectItem>
                <SelectItem value="video">Solo videos</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button
            type="button"
            variant={unused ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setUnused(!unused); setPage(1); }}
          >
            Sin usos
          </Button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : assets.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ImageOff className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          No hay medios que coincidan con los filtros
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3">
          {assets.map((asset) => {
            const isSelected = selectedIds.includes(asset.id);
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => (selectable ? onSelect?.(asset) : onAssetClick?.(asset))}
                className={cn(
                  'relative group rounded-lg overflow-hidden border-2 bg-gray-50 transition-colors',
                  asset.folder === 'PRODUCTS' ? 'aspect-product' : 'aspect-square',
                  isSelected ? 'border-[#111111]' : 'border-transparent hover:border-gray-300'
                )}
              >
                <MediaThumb
                  storageKey={asset.storageKey}
                  mimeType={asset.mimeType}
                  altText={asset.altText ?? asset.fileName}
                  previewStart={asset.previewStartSeconds}
                  previewDuration={asset.previewDurationSeconds}
                />
                {isSelected && (
                  <div className="absolute top-1 right-1 bg-[#111111] text-white rounded-full p-1">
                    <Check className="w-3 h-3" />
                  </div>
                )}
                {asset.origin === 'reused' && (
                  <div className="absolute top-1 left-1 bg-sky-600 text-white text-[9px] font-medium px-1.5 py-0.5 rounded">
                    Reutilizado
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                  {asset.fileName}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {multiple && selectedIds.length > 0 && (
        <div className="mt-3">
          <Badge variant="outline">{selectedIds.length} seleccionados</Badge>
        </div>
      )}
    </div>
  );
}
