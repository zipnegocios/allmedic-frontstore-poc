'use client';

import { useState, useEffect } from 'react';
import { ResponsiveDialog } from '@/components/admin/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Search, ChevronsUpDown } from 'lucide-react';
import { MediaGallery } from './MediaGallery';
import { MediaUploadPanel } from './MediaUploadPanel';
import { MEDIA_FOLDERS, COVER_SEGMENT, sanitizeCodeSegment, type MediaAssetSummary } from '@/lib/media';
import type { MediaUploadResult } from '@/hooks/useMediaUpload';

interface OtherProductOption {
  id: string;
  name: string;
  code: string;
  brandName: string;
}

interface OtherColorOption {
  id: string;
  name: string;
  code: string;
}

const FOLDER_LABELS: Record<string, string> = {
  PRODUCTS: 'Productos',
  SETS: 'Sets',
  BRANDS: 'Marcas',
  BANNERS: 'Banners',
  SITE: 'Sitio',
  SWATCHES: 'Muestras',
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
  /** Acota lo "vinculado a esta entidad" (`linkedEntityType`/`linkedEntityId`)
   * a un color puntual de PRODUCT — sin esto, ese término trae vínculos de
   * TODOS los colores del producto (bug de picker de galería mostrando otros
   * colores mezclados). `null` = portada del producto; string = galería de
   * ese color; omitido = sin acotar (comportamiento previo, ej. SET). */
  linkedColorId?: string | null;
  /** Texto del aviso de carpeta enfocada (ej. "Mostrando la carpeta de
   * Camisa Antifluidos (Azul)."). Si no viene, cae al texto genérico. */
  folderLabel?: string;
  /** Portadas de set en modo "Portadas del contenido": restringe la pestaña de
   * librería a lo vinculado a cualquiera de estos productos (galerías de las
   * piezas del set). Cuando viene, oculta el toggle "insertar desde otra
   * ubicación" — es un scope fijo, no un punto de partida enfocado. */
  productIds?: string[];
}

export function MediaPicker({ open, onClose, folder, segments = [], multiple = false, mediaType: fixedMediaType, onConfirm, keyPrefix, linkedEntityType, linkedEntityId, linkedColorId, folderLabel, productIds }: MediaPickerProps) {
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
  // "Otra ubicación": producto/color elegidos para re-enfocar el listado a esa
  // OTRA entidad (reutiliza el mismo mecanismo de keyPrefix/linkedEntityId/
  // linkedColorId ya usado para la entidad que abrió el picker). Ambos
  // opcionales — sin selección, `browseAll` muestra biblioteca completa como
  // antes. El color usa el sentinel `'__COVER__'` para "Portada" del otro
  // producto (mismo significado que `linkedColorId: null`, pero un <Select>
  // no admite `null` como value).
  const [otherProducts, setOtherProducts] = useState<OtherProductOption[]>([]);
  const [otherProductId, setOtherProductId] = useState<string | null>(null);
  const [otherProductPopoverOpen, setOtherProductPopoverOpen] = useState(false);
  const [otherColors, setOtherColors] = useState<OtherColorOption[]>([]);
  const [otherColorId, setOtherColorId] = useState<string | null>(null);
  const [otherColorPopoverOpen, setOtherColorPopoverOpen] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setBrowseAll(false);
      setOtherProductId(null);
      setOtherColorId(null);
    }
  }

  // Carga el catálogo liviano una sola vez al entrar a "otra ubicación" (no
  // de entrada, para no pagar el fetch si el admin nunca lo usa).
  useEffect(() => {
    if (!browseAll || otherProducts.length > 0) return;
    fetch('/api/admin/products/lite')
      .then((res) => res.json())
      .then((data) => setOtherProducts(data.products ?? []))
      .catch(() => setOtherProducts([]));
  }, [browseAll, otherProducts.length]);

  // Colores del producto elegido en "otra ubicación" — bajo demanda, recién
  // al seleccionar producto (no de entrada, para no traer colores de todo el
  // catálogo). Solo dispara el fetch cuando hay id; limpiar la lista al
  // deseleccionar producto ocurre en `selectOtherProduct` (mismo evento que
  // cambia `otherProductId`), no acá, para evitar el set-state-in-effect que
  // dispararía un render en cascada extra.
  useEffect(() => {
    if (!otherProductId) return;
    fetch(`/api/admin/products/${otherProductId}/colors`)
      .then((res) => res.json())
      .then((data) => setOtherColors(data.colors ?? []))
      .catch(() => setOtherColors([]));
  }, [otherProductId]);

  function selectOtherProduct(id: string | null) {
    setOtherProductId(id);
    setOtherColorId(null);
    if (!id) setOtherColors([]);
    setOtherProductPopoverOpen(false);
  }

  const otherProduct = otherProducts.find((p) => p.id === otherProductId);
  const otherColorSegment = otherColorId === '__COVER__'
    ? COVER_SEGMENT
    : (otherColorId ? sanitizeCodeSegment(otherColors.find((c) => c.id === otherColorId)?.code ?? '') : undefined);
  // Carpeta del OTRO producto elegido — mismo esquema que `pickerKeyPrefix` en
  // `ProductForm` (`products/{código-producto}/{código-color|portada}/`). Con
  // producto pero sin color ("Todos los colores"), el prefijo se acorta a la
  // carpeta raíz del producto (`products/{código-producto}/`) — el filtrado
  // por `linkedEntityType`/`linkedEntityId` en `listMediaAssets` solo corre
  // dentro de `if (keyPrefix)`, así que necesita algún prefijo no vacío para
  // activar el vínculo por entidad aunque no haya color puntual.
  const otherKeyPrefix = otherProduct
    ? `products/${sanitizeCodeSegment(otherProduct.code)}/${otherColorSegment ?? ''}`
    : undefined;
  const otherLinkedColorId: string | null | undefined = otherColorId === '__COVER__'
    ? null
    : (otherColorId ?? undefined);

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
              <div className="mt-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-500">
                    {browseAll ? 'Mostrando toda la biblioteca.' : (folderLabel ?? 'Mostrando la carpeta de este producto.')}
                  </span>
                  <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setBrowseAll((v) => !v)}>
                    {browseAll ? 'Volver a la carpeta del producto' : 'Insertar imagen desde otra ubicación'}
                  </Button>
                </div>
                {browseAll && (
                  <div className="flex items-center gap-2 mt-2">
                    <Popover open={otherProductPopoverOpen} onOpenChange={setOtherProductPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" role="combobox" size="sm" className="flex-1 min-w-0 justify-between font-normal">
                          <span className="truncate">{otherProduct ? otherProduct.name : 'Todos los productos'}</span>
                          <ChevronsUpDown className="w-3.5 h-3.5 opacity-50 ml-2 flex-shrink-0" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[320px] max-w-[calc(100vw-2rem)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar producto..." />
                          <CommandList>
                            <CommandEmpty>Sin resultados.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem value="__ALL__" onSelect={() => selectOtherProduct(null)}>
                                Todos los productos
                              </CommandItem>
                              {otherProducts.map((p) => (
                                <CommandItem
                                  key={p.id}
                                  value={`${p.name} ${p.code} ${p.brandName}`}
                                  onSelect={() => selectOtherProduct(p.id)}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm truncate">{p.name}</p>
                                    <p className="text-xs text-gray-400 truncate">{p.code}{p.brandName ? ` · ${p.brandName}` : ''}</p>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Popover open={otherColorPopoverOpen} onOpenChange={setOtherColorPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          size="sm"
                          disabled={!otherProductId}
                          className="flex-1 min-w-0 justify-between font-normal"
                        >
                          <span className="truncate">
                            {otherColorId === '__COVER__' ? 'Portada' : (otherColors.find((c) => c.id === otherColorId)?.name ?? 'Todos los colores')}
                          </span>
                          <ChevronsUpDown className="w-3.5 h-3.5 opacity-50 ml-2 flex-shrink-0" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[240px] max-w-[calc(100vw-2rem)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar color..." />
                          <CommandList>
                            <CommandEmpty>Sin resultados.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem value="__ALL__" onSelect={() => { setOtherColorId(null); setOtherColorPopoverOpen(false); }}>
                                Todos los colores
                              </CommandItem>
                              <CommandItem value="Portada" onSelect={() => { setOtherColorId('__COVER__'); setOtherColorPopoverOpen(false); }}>
                                Portada
                              </CommandItem>
                              {otherColors.map((c) => (
                                <CommandItem
                                  key={c.id}
                                  value={c.name}
                                  onSelect={() => { setOtherColorId(c.id); setOtherColorPopoverOpen(false); }}
                                >
                                  {c.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
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
            keyPrefix={productIds ? undefined : (browseAll ? otherKeyPrefix : keyPrefix)}
            linkedEntityType={productIds ? undefined : (browseAll ? (otherProductId ? 'PRODUCT' : undefined) : linkedEntityType)}
            linkedEntityId={productIds ? undefined : (browseAll ? (otherProductId ?? undefined) : linkedEntityId)}
            linkedColorId={productIds ? undefined : (browseAll ? otherLinkedColorId : linkedColorId)}
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
