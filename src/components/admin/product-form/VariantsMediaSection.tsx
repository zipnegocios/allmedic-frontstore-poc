'use client';

import { useState, useEffect } from 'react';
import type { Control, UseFormRegister, UseFormWatch, UseFormSetValue, FieldArrayWithId, FieldErrors } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Trash2, ImageIcon, AlertTriangle } from 'lucide-react';
import { MediaThumb } from '@/components/admin/media/MediaThumb';
import { cn } from '@/lib/utils';
import type { ProductFormData, Color } from './schema';
import { SIZES, STATUSES, STATUS_META } from './schema';
import { AttributeMatrixSection } from './AttributeMatrixSection';
import { GalleryImageTile } from './GalleryImageTile';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildValidationSummaryGrouped } from './validation-summary';

interface VariantsMediaSectionProps {
  control: Control<ProductFormData>;
  register: UseFormRegister<ProductFormData>;
  watch: UseFormWatch<ProductFormData>;
  setValue: UseFormSetValue<ProductFormData>;
  colors: Color[];
  /** Tipo de producto elegido en la pestaña General — impulsa qué atributos EAV
   * están disponibles para el generador de matriz. */
  productTypeId: string | undefined;
  /** Valores de "Atributos (Estilos)" elegidos en General (`AttributeStyleSection`,
   * mapa attributeId -> valueId) — se propagan tal cual a `attributeValueIds` de
   * cada variante que genera la matriz color×talla (`AttributeMatrixSection`). */
  styleAttributes: Record<string, string>;
  variantFields: FieldArrayWithId<ProductFormData, 'variants', 'id'>[];
  appendVariant: (value: Omit<ProductFormData['variants'][number], 'id'> & { id?: string }) => void;
  removeVariant: (index: number) => void;
  imageFields: FieldArrayWithId<ProductFormData, 'images', 'id'>[];
  removeImage: (index: number) => void;
  onPickTarget: (target: number | 'append' | 'cover', colorId?: string) => void;
  /** Errores de validación por fila de variante (`errors.variants` de RHF) — sin esto,
   * una matriz con filas inválidas (ej. sin Color/Talla) no muestra ningún indicador
   * visual aquí, solo un toast genérico en el formulario padre. */
  variantsErrors?: FieldErrors<ProductFormData>['variants'];
  /** Errores de validación completos del formulario (`formState.errors`) — usado
   * únicamente para el modal de detalle que se abre al hacer clic en el badge
   * "Con errores" de un color, que mapea tanto la ficha general como
   * variantes/medios en un solo lugar. */
  formErrors?: FieldErrors<ProductFormData>;
  /** Se dispara al crear un color desde el generador de matriz (`AttributeMatrixSection`)
   * sin salir del formulario — el llamador (`ProductForm`) actualiza su lista de
   * colores disponibles. */
  onColorCreated?: (color: Color) => void;
}

export function VariantsMediaSection({
  control,
  register,
  watch,
  setValue,
  colors,
  productTypeId,
  styleAttributes,
  variantFields,
  appendVariant,
  removeVariant,
  imageFields,
  removeImage,
  onPickTarget,
  variantsErrors,
  formErrors,
  onColorCreated,
}: VariantsMediaSectionProps) {
  // Modal de detalle de errores — se abre al hacer clic en el badge "Con errores"
  // de cualquier color; muestra el mapeo completo (ficha general + variantes y
  // medios), no solo lo que falla en ese color puntual.
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const errorSummary = buildValidationSummaryGrouped(formErrors ?? {});

  // Estado para el diálogo de advertencia de coherencia al borrar la última variante de un color
  const [deleteConfirm, setDeleteConfirm] = useState<{
    variantIdx: number;
    colorId: string;
  } | null>(null);

  // Estado para agregar un nuevo color
  const [selectedNewColorId, setSelectedNewColorId] = useState<string>('');

  // 1. Obtener los colores activos (que tienen variantes o imágenes asociadas)
  const activeColorsSet = new Set<string>();
  variantFields.forEach((v) => {
    if (v.colorId) activeColorsSet.add(v.colorId);
  });
  imageFields.forEach((img) => {
    if (img.colorId) activeColorsSet.add(img.colorId);
  });
  const activeColorIds = Array.from(activeColorsSet);

  // 2. Medios de galería sin color (legacy)
  const colorlessImages = imageFields.filter((img) => !img.colorId);
  const hasColorlessImages = colorlessImages.length > 0;

  // Sección "Configuración por Color" como acordeón de una sola apertura: solo un
  // color expandido a la vez para simplificar el panel cuando hay varios.
  const [expandedColorId, setExpandedColorId] = useState<string | undefined>(() => activeColorIds[0]);

  // Tras un intento de guardado inválido, si alguna variante colapsada tiene error,
  // expandimos automáticamente el primer color afectado para que sea encontrable
  // sin tener que abrir cada sección manualmente.
  useEffect(() => {
    if (!variantsErrors || !Array.isArray(variantsErrors)) return;
    const firstErrorColorId = activeColorIds.find((colorId) =>
      variantFields.some((v, idx) => v.colorId === colorId && variantsErrors[idx])
    );
    if (firstErrorColorId) setExpandedColorId(firstErrorColorId);
    // Solo reacciona a cambios en los errores de validación (ej. tras un submit
    // fallido), no en cada render por cambios de `activeColorIds`/`variantFields`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantsErrors]);

  // Manejar eliminación de una variante
  const handleDeleteVariantClick = (variantIdx: number, colorId: string) => {
    const colorVariants = variantFields.filter((v) => v.colorId === colorId);
    const colorImages = imageFields.filter((img) => img.colorId === colorId);

    // Si es la última variante de este color y aún quedan imágenes asociadas
    if (colorVariants.length === 1 && colorImages.length > 0) {
      setDeleteConfirm({ variantIdx, colorId });
    } else {
      // Eliminar normalmente
      const absoluteIdx = variantFields.findIndex((_, idx) => idx === variantIdx);
      if (absoluteIdx !== -1) {
        removeVariant(absoluteIdx);
      }
    }
  };

  // Confirmar eliminación de la última variante y sus medios asociados
  const handleConfirmDeleteAll = () => {
    if (!deleteConfirm) return;
    const { variantIdx, colorId } = deleteConfirm;

    // 1. Eliminar la variante
    const absoluteVariantIdx = variantFields.findIndex((_, idx) => idx === variantIdx);
    if (absoluteVariantIdx !== -1) {
      removeVariant(absoluteVariantIdx);
    }

    // 2. Eliminar todas las imágenes del mismo color
    // Hacemos el reverso de índices para evitar corrupciones al borrar
    const imagesToDelete = imageFields
      .map((img, idx) => ({ img, idx }))
      .filter((item) => item.img.colorId === colorId);

    imagesToDelete.reverse().forEach((item) => {
      removeImage(item.idx);
    });

    setDeleteConfirm(null);
  };

  // Confirmar eliminación de variante pero reasignar medios a otro color
  const handleConfirmDeleteAndReassign = (newColorId: string) => {
    if (!deleteConfirm || !newColorId) return;
    const { variantIdx, colorId } = deleteConfirm;

    // 1. Eliminar la variante
    const absoluteVariantIdx = variantFields.findIndex((_, idx) => idx === variantIdx);

    if (absoluteVariantIdx !== -1) {
      removeVariant(absoluteVariantIdx);
    }

    // 2. Reasignar imágenes al nuevo color
    imageFields.forEach((img, idx) => {
      if (img.colorId === colorId) {
        setValue(`images.${idx}.colorId`, newColorId);
      }
    });

    setDeleteConfirm(null);
  };

  // Agregar un nuevo color al formulario
  const handleAddColor = () => {
    if (!selectedNewColorId) return;
    // Creamos la primera variante vacía para este color para que aparezca su tarjeta
    appendVariant({
      colorId: selectedNewColorId,
      size: 'M',
      sku: '',
      status: 'AVAILABLE',
      attributeValueIds: [],
    });
    setExpandedColorId(selectedNewColorId);
    setSelectedNewColorId('');
  };

  // Colores disponibles para agregar (que no estén activos)
  const availableColorsToAdd = colors.filter((c) => !activeColorIds.includes(c.id));

  // ─── Galería: drag & drop y "imagen principal" (Smart Chips / Drag-Zone) ───
  // `distance: 4` evita que un clic simple en los botones (estrella/lápiz/trash)
  // de la miniatura dispare accidentalmente un drag.
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  /** Reordena las imágenes de un color al soltar un drag — recalcula `sortOrder`
   * (0..n-1) según la nueva posición dentro de ESE color; no toca imágenes de
   * otros colores. `orderedColorImages` ya viene ordenado por `sortOrder` actual. */
  function handleGalleryDragEnd(
    orderedColorImages: { img: ProductFormData['images'][number]; idx: number }[],
    event: DragEndEvent
  ) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedColorImages.findIndex((item) => (item.img.id || String(item.idx)) === active.id);
    const newIndex = orderedColorImages.findIndex((item) => (item.img.id || String(item.idx)) === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(orderedColorImages, oldIndex, newIndex);
    reordered.forEach((item, position) => {
      setValue(`images.${item.idx}.sortOrder`, position, { shouldDirty: true });
    });
  }

  /** Marca una imagen como principal del color: pasa a `sortOrder = 0` y el resto
   * del grupo se reindexa `1..n-1` preservando su orden relativo. El catálogo
   * público usa `images[0]` (por `sortOrder`) de cada color como swatch, así que
   * esto es puramente un reordenamiento, sin flag ni cambios de esquema. */
  function handleSetPrimaryImage(
    orderedColorImages: { img: ProductFormData['images'][number]; idx: number }[],
    absoluteIdx: number
  ) {
    const others = orderedColorImages.filter((item) => item.idx !== absoluteIdx);
    setValue(`images.${absoluteIdx}.sortOrder`, 0, { shouldDirty: true });
    others.forEach((item, i) => {
      setValue(`images.${item.idx}.sortOrder`, i + 1, { shouldDirty: true });
    });
  }

  return (
    <div className="space-y-6">
      {/* ─── CARD PORTADA OBLIGATORIA ─── */}
      <Card className="border-2 border-gray-200 dark:border-gray-800">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#111111] flex items-center gap-1.5">
                Portada del Producto <span className="text-red-500">*</span>
              </h3>
              <p className="text-xs text-gray-500">
                Selecciona la imagen principal del producto. Es requerida para poder guardar el producto y se mostrará en los listados del catálogo.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPickTarget('cover')}
              className="bg-white border-gray-200 hover:bg-gray-50 hover:text-gray-900"
            >
              <ImageIcon className="w-4 h-4 mr-2 text-gray-500" />
              {watch('cover.url') ? 'Cambiar Portada' : 'Elegir Portada'}
            </Button>
          </div>

          {watch('cover.storageKey') ? (
            <div className="flex flex-col sm:flex-row items-start gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
              <div className="relative w-32 h-32 bg-white rounded-lg overflow-hidden border flex-shrink-0 shadow-sm">
                <MediaThumb
                  storageKey={watch('cover.storageKey')!}
                  mimeType={watch('cover.mimeType') ?? ''}
                  sizes="128px"
                />
              </div>
              <div className="flex-1 w-full space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-700">Texto Alternativo (Alt) *</Label>
                  <Input
                    className="text-xs bg-white"
                    {...register('cover.alt')}
                    placeholder="Describe la foto (ej: Modelo vistiendo camisa celeste en talla M)"
                  />
                  <p className="text-[10px] text-gray-400">Requerido para accesibilidad y optimización SEO.</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setValue('cover.assetId', '');
                    setValue('cover.url', '');
                    setValue('cover.storageKey', '');
                    setValue('cover.mimeType', '');
                    setValue('cover.alt', '');
                  }}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 h-8"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Quitar Portada
                </Button>
              </div>
            </div>
          ) : (
            <div className="border border-dashed rounded-lg p-6 text-center text-gray-400 text-xs flex flex-col items-center justify-center gap-2">
              <ImageIcon className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
              <span>No se ha seleccionado ninguna portada. Haz clic en &quot;Elegir Portada&quot; para asignar una.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── BARRA PENDIENTES DE ASIGNAR COLOR ─── */}
      {hasColorlessImages && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
          <div className="flex items-center gap-2 text-amber-800 text-sm font-semibold">
            <AlertTriangle className="w-4 h-4" />
            Existen medios sin color asignado
          </div>
          <p className="text-xs text-amber-700">
            Para guardar los cambios del producto, debes asignar cada uno de estos medios a un color específico del producto (los medios del catálogo exigen pertenecer a un color).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {colorlessImages.map((img) => {
              const absoluteIdx = imageFields.findIndex((f) => f.id === img.id);
              return (
                <div key={img.id} className="flex items-center gap-3 bg-white p-3 rounded-lg border shadow-sm">
                  <div className="w-12 h-12 rounded overflow-hidden bg-gray-50 flex-shrink-0 border">
                    <MediaThumb storageKey={img.storageKey!} mimeType={img.mimeType ?? ''} sizes="48px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Label className="text-[10px] font-semibold text-gray-500">Color asociado *</Label>
                    <Controller
                      name={`images.${absoluteIdx}.colorId`}
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value || ''}
                          onValueChange={(val) => {
                            field.onChange(val);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs bg-white">
                            <SelectValue placeholder="Elegir color" />
                          </SelectTrigger>
                          <SelectContent>
                            {colors.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full border" style={{ backgroundColor: c.hex }} />
                                  {c.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeImage(absoluteIdx)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── GENERADOR DE MATRIZ DE VARIANTES (Fase 3.4) ─── */}
      <AttributeMatrixSection
        productTypeId={productTypeId}
        styleAttributes={styleAttributes}
        colors={colors}
        variantFields={variantFields}
        appendVariant={appendVariant}
        onColorCreated={onColorCreated}
        onMatrixGenerated={(colorIds) => colorIds[0] && setExpandedColorId(colorIds[0])}
      />

      {/* ─── LISTADO DE GRUPOS POR COLOR ─── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-gray-900">Configuración por Color</h3>
          <div className="flex items-center gap-2">
            <Select value={selectedNewColorId} onValueChange={setSelectedNewColorId}>
              <SelectTrigger className="w-48 h-8 text-xs bg-white">
                <SelectValue placeholder="Seleccionar color..." />
              </SelectTrigger>
              <SelectContent>
                {availableColorsToAdd.length === 0 ? (
                  <SelectItem value="_none" disabled>Todos los colores activos</SelectItem>
                ) : (
                  availableColorsToAdd.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: c.hex }} />
                        {c.name}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              onClick={handleAddColor}
              disabled={!selectedNewColorId || selectedNewColorId === '_none'}
              className="h-8 text-xs bg-[#111111]"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Agregar Color
            </Button>
          </div>
        </div>

        {activeColorIds.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-gray-500 text-xs">
              No hay colores configurados. Agrega un color arriba para definir variantes y cargar medios.
            </CardContent>
          </Card>
        ) : (
          <Accordion
            type="single"
            collapsible
            value={expandedColorId}
            onValueChange={(value) => setExpandedColorId(value || undefined)}
            className="space-y-3"
          >
          {activeColorIds.map((colorId) => {
            const colorObj = colors.find((c) => c.id === colorId);
            const colorName = colorObj?.name || 'Color desconocido';
            const colorHex = colorObj?.hex || '#ccc';

            // Filtrar variantes e imágenes correspondientes a este color
            const colorVariants = variantFields
              .map((v, idx) => ({ v, idx }))
              .filter((item) => item.v.colorId === colorId);

            // Ordenado por `sortOrder` ascendente: la posición visual debe coincidir
            // con la que consume el catálogo público (`images[0]` = swatch del color).
            const colorImages = imageFields
              .map((img, idx) => ({ img, idx }))
              .filter((item) => item.img.colorId === colorId)
              .sort((a, b) => (a.img.sortOrder ?? 0) - (b.img.sortOrder ?? 0));

            const colorHasError =
              colorVariants.some((item) => variantsErrors?.[item.idx]) ||
              (colorVariants.length > 0 && colorImages.length === 0);

            return (
              <AccordionItem
                key={colorId}
                value={colorId}
                className="border border-gray-200 shadow-sm overflow-hidden rounded-lg bg-white"
              >
                <AccordionTrigger
                  className="px-4 py-3 bg-gray-50 dark:bg-gray-900 hover:no-underline hover:bg-gray-100 [&[data-state=open]]:border-b rounded-none"
                  actions={
                    <>
                      {colorHasError && (
                        <button
                          type="button"
                          className="inline-flex appearance-none bg-transparent border-0 p-0"
                          onClick={(e) => {
                            // Evita que el clic también dispare el toggle del acordeón.
                            e.stopPropagation();
                            setErrorModalOpen(true);
                          }}
                        >
                          <Badge
                            variant="destructive"
                            className="text-[10px] cursor-pointer hover:bg-destructive/80 mr-1"
                          >
                            <AlertTriangle className="w-3 h-3 mr-1" /> Con errores
                          </Badge>
                        </button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Eliminar todo el grupo de color
                          const variantsToDelete = colorVariants.map(item => item.idx);
                          const imagesToDelete = colorImages.map(item => item.idx);

                          // Eliminar variantes
                          variantsToDelete.reverse().forEach(idx => removeVariant(idx));
                          // Eliminar imágenes
                          imagesToDelete.reverse().forEach(idx => removeImage(idx));
                        }}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-2 mr-2"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Eliminar color
                      </Button>
                    </>
                  }
                >
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="w-5 h-5 rounded-full border border-gray-300 shadow-sm shrink-0" style={{ backgroundColor: colorHex }} />
                    <span className="font-semibold text-sm text-gray-900">{colorName}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {colorVariants.length} tallas · {colorImages.length} fotos/videos
                    </Badge>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="p-4 pt-4 space-y-6">
                  {/* Sección 1: Variantes (Tallas) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                        Tallas del Color
                        {colorVariants.length === 0 && (
                          <span className="text-xs text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 border border-amber-200 flex items-center gap-1 font-normal">
                            <AlertTriangle className="w-3 h-3" /> Sin tallas definidas
                          </span>
                        )}
                      </Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          appendVariant({
                            colorId: colorId,
                            size: 'M',
                            sku: '',
                            status: 'AVAILABLE',
                            attributeValueIds: [],
                          })
                        }
                        className="h-7 text-[10px] bg-white"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Agregar Talla
                      </Button>
                    </div>

                    {colorVariants.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {colorVariants.map((item, localIdx) => {
                          const v = item.v;
                          const absoluteIdx = item.idx;
                          const rowError = variantsErrors?.[absoluteIdx];
                          const hasRowError = Boolean(rowError?.colorId || rowError?.size);
                          const statusMeta = STATUS_META[v.status] ?? STATUS_META.AVAILABLE;

                          return (
                            <div
                              key={v.id || localIdx}
                              className={cn(
                                'inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full border bg-white text-xs',
                                hasRowError ? 'ring-2 ring-red-400 border-red-300' : 'border-gray-200'
                              )}
                            >
                              {/* Talla */}
                              <Controller
                                name={`variants.${absoluteIdx}.size`}
                                control={control}
                                render={({ field }) => (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button type="button" className="font-semibold hover:underline">
                                        {field.value || 'Talla'}
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-40 p-1" align="start">
                                      <div className="grid grid-cols-3 gap-1">
                                        {SIZES.map((s) => (
                                          <button
                                            key={s}
                                            type="button"
                                            onClick={() => field.onChange(s)}
                                            className={cn(
                                              'text-xs rounded px-1.5 py-1 border',
                                              field.value === s ? 'bg-[#111111] text-white border-[#111111]' : 'bg-white border-gray-200'
                                            )}
                                          >
                                            {s}
                                          </button>
                                        ))}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )}
                              />

                              <span className="text-gray-300">·</span>

                              {/* Estado */}
                              <Controller
                                name={`variants.${absoluteIdx}.status`}
                                control={control}
                                render={({ field }) => (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button type="button" className="flex items-center gap-1 hover:underline">
                                        <span className={cn('w-2 h-2 rounded-full', statusMeta.dot)} />
                                        {statusMeta.label}
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-44 p-1" align="start">
                                      <div className="flex flex-col gap-0.5">
                                        {STATUSES.map((s) => (
                                          <button
                                            key={s.value}
                                            type="button"
                                            onClick={() => field.onChange(s.value)}
                                            className={cn(
                                              'flex items-center gap-1.5 text-xs rounded px-2 py-1.5 text-left',
                                              field.value === s.value ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'
                                            )}
                                          >
                                            <span className={cn('w-2 h-2 rounded-full', STATUS_META[s.value]?.dot)} />
                                            {s.label}
                                          </button>
                                        ))}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )}
                              />

                              {/* Acción */}
                              <button
                                type="button"
                                onClick={() => handleDeleteVariantClick(absoluteIdx, colorId)}
                                className="text-red-400 hover:text-red-600 ml-0.5 p-0.5"
                                title="Eliminar talla"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Párrafo divisor */}
                  <div className="border-t border-gray-100 my-4" />

                  {/* Sección 2: Medios del Color */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-gray-700">Galería del Color</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onPickTarget('append', colorId)}
                        className="h-7 text-[10px] bg-white"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Agregar Medios
                      </Button>
                    </div>

                    {colorImages.length === 0 ? (
                      <div className="border border-dashed rounded-lg p-4 text-center text-gray-400 text-[11px]">
                        No hay medios asociados a este color.
                      </div>
                    ) : (
                      <DndContext
                        sensors={dndSensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => handleGalleryDragEnd(colorImages, event)}
                      >
                        <SortableContext
                          items={colorImages.map((item) => item.img.id || String(item.idx))}
                          strategy={rectSortingStrategy}
                        >
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {colorImages.map((item) => {
                              const img = item.img;
                              const absoluteIdx = item.idx;

                              return (
                                <GalleryImageTile
                                  key={img.id || absoluteIdx}
                                  fieldId={img.id || String(absoluteIdx)}
                                  absoluteIdx={absoluteIdx}
                                  storageKey={img.storageKey!}
                                  mimeType={img.mimeType ?? ''}
                                  alt={img.alt}
                                  isPrimary={colorImages[0]?.idx === absoluteIdx}
                                  register={register}
                                  onRemove={() => removeImage(absoluteIdx)}
                                  onSetPrimary={() => handleSetPrimaryImage(colorImages, absoluteIdx)}
                                />
                              );
                            })}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
          </Accordion>
        )}
      </div>

      {/* ─── ALERT DIALOG DE COHERENCIA ─── */}
      <AlertDialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">¿Eliminar la última variante de este color?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-500">
              Estás borrando la última talla disponible para este color, pero el color aún tiene imágenes asociadas en la galería. Para mantener la coherencia de la tienda, elige qué hacer con los medios de este color:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 py-3">
            {colors
              .filter(c => c.id !== deleteConfirm?.colorId && activeColorIds.includes(c.id))
              .map(c => (
                <Button
                  key={c.id}
                  type="button"
                  variant="outline"
                  onClick={() => handleConfirmDeleteAndReassign(c.id)}
                  className="w-full text-xs justify-start"
                >
                  <span className="w-3 h-3 rounded-full border mr-2" style={{ backgroundColor: c.hex }} />
                  Reasignar medios al color: <strong className="ml-1">{c.name}</strong>
                </Button>
              ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirm(null)} className="text-xs">
              Cancelar
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDeleteAll}
              className="text-xs"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Eliminar variante y todos sus medios
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── MODAL DE DETALLE DE ERRORES ─── */}
      <Dialog open={errorModalOpen} onOpenChange={setErrorModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-4 h-4" />
              Campos obligatorios pendientes
            </DialogTitle>
            <DialogDescription>
              Estos son los campos que faltan completar para poder guardar el producto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-700">Ficha General</p>
              {errorSummary.general.length > 0 ? (
                <ul className="list-disc pl-4 text-sm text-red-600 space-y-0.5">
                  {errorSummary.general.map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-400">Sin errores en esta sección.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-700">Variantes y Medios</p>
              {errorSummary.variantsMedia.length > 0 ? (
                <ul className="list-disc pl-4 text-sm text-red-600 space-y-0.5">
                  {errorSummary.variantsMedia.map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-400">Sin errores en esta sección.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
