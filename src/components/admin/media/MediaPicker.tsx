'use client';

import { useState } from 'react';
import { ResponsiveDialog } from '@/components/admin/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MediaGallery } from './MediaGallery';
import { MediaUploadPanel } from './MediaUploadPanel';
import type { MediaAssetSummary } from '@/lib/media';
import type { MediaUploadResult } from '@/hooks/useMediaUpload';

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

export function MediaPicker({ open, onClose, folder, segments = [], multiple = false, mediaType, onConfirm, keyPrefix, linkedEntityType, linkedEntityId, productIds }: MediaPickerProps) {
  const [selected, setSelected] = useState<MediaAssetSummary[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState('library');
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
      description="Elige un medio existente de la librería o sube uno nuevo."
      contentClassName="max-w-4xl"
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
        <TabsList>
          <TabsTrigger value="library">Elegir de la librería</TabsTrigger>
          <TabsTrigger value="upload">Subir nueva</TabsTrigger>
        </TabsList>
        <TabsContent value="library">
          {keyPrefix && !productIds && (
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="text-gray-500">
                {browseAll ? 'Mostrando toda la biblioteca.' : 'Mostrando la carpeta de este producto.'}
              </span>
              <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setBrowseAll((v) => !v)}>
                {browseAll ? 'Volver a la carpeta del producto' : 'Insertar imagen desde otra ubicación'}
              </Button>
            </div>
          )}
          <MediaGallery
            folder={productIds ? undefined : folder}
            mediaType={mediaType}
            selectable
            multiple={multiple}
            selectedIds={selected.map((a) => a.id)}
            onSelect={toggleSelect}
            refreshKey={refreshKey}
            keyPrefix={browseAll || productIds ? undefined : keyPrefix}
            linkedEntityType={browseAll || productIds ? undefined : linkedEntityType}
            linkedEntityId={browseAll || productIds ? undefined : linkedEntityId}
            productIds={productIds}
          />
        </TabsContent>
        <TabsContent value="upload">
          <MediaUploadPanel folder={folder} segments={segments} onUploaded={handleUploaded} />
        </TabsContent>
      </Tabs>
    </ResponsiveDialog>
  );
}
