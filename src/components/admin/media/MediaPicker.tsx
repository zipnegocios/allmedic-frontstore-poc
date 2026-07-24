'use client';

import { useState } from 'react';
import { ResponsiveDialog } from '@/components/admin/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';
import { MediaGallery } from './MediaGallery';
import { MediaUploadPanel } from './MediaUploadPanel';
import { MEDIA_FOLDERS, type MediaAssetSummary } from '@/lib/media';
import type { MediaUploadResult } from '@/hooks/useMediaUpload';

const FOLDER_LABELS: Record<string, string> = {
  PRODUCTS: 'Productos',
  SETS: 'Sets',
  BRANDS: 'Marcas',
  BANNERS: 'Banners',
  SITE: 'Sitio',
};

interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  folder: string;
  segments?: string[];
  multiple?: boolean;
  mediaType?: 'image' | 'video' | 'all';
  onConfirm: (assets: MediaAssetSummary[]) => void;
  /** Picker enfocado: cuando viene, la pestaña "Elegir de la librería" arranca
   * restringida a la carpeta de la entidad (+ lo ya vinculado a ella) — con un
   * botón para salir a la biblioteca completa sin perder el contexto de subida. */
  keyPrefix?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  /** Portadas de set en modo "Portadas del contenido": restringe la pestaña de
   * librería a lo vinculado a cualquiera de estos productos (galerías de las
   * piezas del set). Cuando viene, oculta el toggle "insertar desde otra
   * ubicación" — es un scope fijo, no un punto de partida enfocado. */
  productIds?: string[];
}

export function MediaPicker({ open, onClose, folder, segments = [], multiple = false, mediaType: fixedMediaType, onConfirm, keyPrefix, linkedEntityType, linkedEntityId, productIds }: MediaPickerProps) {
  const [selected, setSelected] = useState<MediaAssetSummary[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState('library');
  const [q, setQ] = useState('');
  const [folderFilter, setFolderFilter] = useState('all');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'image' | 'video' | 'all'>('all');
  const [unused, setUnused] = useState(false);
  // Réplica de la condición que ya usaba MediaGallery internamente para
  // decidir su selector de carpeta: cuando NO hay `productIds`, la carpeta
  // queda fija a `folder` (prop de MediaPicker) y no hace falta selector.
  // Con `productIds` (modo "Portadas del contenido"), la carpeta no está
  // fija — sí corresponde mostrar el selector. Movido acá porque los
  // controles ahora viven en el grid de MediaPicker, no dentro de MediaGallery.
  const showFolderSelect = !!productIds;
  const showMediaTypeSelect = !fixedMediaType;
  // Arranca enfocado si hay `keyPrefix`; el admin puede salir a biblioteca
  // completa con "Insertar desde otra ubicación" sin cerrar el picker. Se
  // resetea a "enfocado" cada vez que el picker se reabre — ajuste de estado en
  // respuesta a un cambio de prop durante el render, sin useEffect (evita el
  // set-state-in-effect que dispara un render en cascada extra).
  const [browseAll, setBrowseAll] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setBrowseAll(false);
  }

  function toggleSelect(asset: MediaAssetSummary) {
    setSelected((prev) => {
      const exists = prev.find((a) => a.id === asset.id);
      if (exists) return prev.filter((a) => a.id !== asset.id);
      if (!multiple) return [asset];
      return [...prev, asset];
    });
  }

  function handleUploaded(results: MediaUploadResult[]) {
    setRefreshKey((k) => k + 1);
    setTab('library');
    setSelected(multiple ? [...selected, ...results] : results);
  }

  function handleConfirm() {
    onConfirm(selected);
    setSelected([]);
    onClose();
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      title="Seleccionar medio"
      hideTitle
      contentClassName="max-w-[95vw] sm:max-w-[95vw] max-h-[95vh]"
      mobileFullScreen
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={selected.length === 0} className="bg-[#111111]">
            Usar {selected.length > 0 ? `(${selected.length})` : ''}
          </Button>
        </>
      )}
    >
      <Tabs value={tab} onValueChange={setTab}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start mb-4">
          <div>
            <TabsList>
              <TabsTrigger value="library">Elegir de la librería</TabsTrigger>
              <TabsTrigger value="upload">Subir nueva</TabsTrigger>
            </TabsList>
            {tab === 'library' && keyPrefix && !productIds && (
              <div className="flex items-center justify-between gap-2 mt-2 text-xs">
                <span className="text-gray-500">
                  {browseAll ? 'Mostrando toda la biblioteca.' : 'Mostrando la carpeta de este producto.'}
                </span>
                <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setBrowseAll((v) => !v)}>
                  {browseAll ? 'Volver a la carpeta del producto' : 'Insertar imagen desde otra ubicación'}
                </Button>
              </div>
            )}
          </div>
          {tab === 'library' && (
            <>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por nombre, alt o título..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {showFolderSelect && (
                  <Select value={folderFilter} onValueChange={setFolderFilter}>
                    <SelectTrigger className="w-[160px]">
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
              </div>
              <div className="flex items-center gap-2">
                {showMediaTypeSelect && (
                  <Select value={mediaTypeFilter} onValueChange={(v) => setMediaTypeFilter(v as 'image' | 'video' | 'all')}>
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
                  onClick={() => setUnused(!unused)}
                >
                  Sin usos
                </Button>
              </div>
            </>
          )}
        </div>
        <TabsContent value="library">
          <MediaGallery
            folder={productIds ? undefined : folder}
            mediaType={fixedMediaType}
            selectable
            multiple={multiple}
            selectedIds={selected.map((a) => a.id)}
            onSelect={toggleSelect}
            refreshKey={refreshKey}
            keyPrefix={browseAll || productIds ? undefined : keyPrefix}
            linkedEntityType={browseAll || productIds ? undefined : linkedEntityType}
            linkedEntityId={browseAll || productIds ? undefined : linkedEntityId}
            productIds={productIds}
            hideFilters
            searchValue={q}
            onSearchChange={setQ}
            folderValue={folderFilter}
            onFolderChange={setFolderFilter}
            mediaTypeValue={mediaTypeFilter}
            onMediaTypeChange={setMediaTypeFilter}
            unusedValue={unused}
            onUnusedChange={setUnused}
          />
        </TabsContent>
        <TabsContent value="upload">
          <MediaUploadPanel folder={folder} segments={segments} onUploaded={handleUploaded} />
        </TabsContent>
      </Tabs>
    </ResponsiveDialog>
  );
}
