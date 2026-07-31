'use client';

import { useEffect, useState } from 'react';
import { useFieldArray, type Control, type UseFormRegister, type UseFormWatch, type UseFormSetValue, type FieldErrors } from 'react-hook-form';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { CoverSlot } from './CoverSlot';
import { computeSetColorIntersection } from './color-mode-utils';
import type { EligibleProduct, SetColorComboData, SetFormData } from './schema';

interface SetColorsSectionProps {
  register: UseFormRegister<SetFormData>;
  control: Control<SetFormData>;
  errors: FieldErrors<SetFormData>;
  watch: UseFormWatch<SetFormData>;
  setValue: UseFormSetValue<SetFormData>;
  setId: string | undefined;
  colorMode: 'PAIRED' | 'MIXED' | undefined;
  /** Lista aplanada de las opciones de bloque (2 bloques, 1 o 2 opciones cada uno). */
  blockItems: Array<{ productId: string }>;
  products: EligibleProduct[];
  hasPieces: boolean;
  onOpenPicker: (index: number, target: 'cover' | 'secondaryCover', mode: 'special' | 'content') => void;
}

function SetColorRow({
  fieldId,
  index,
  colorName,
  colorHex,
  isDefault,
  imageUrl,
  secondaryImageUrl,
  error,
  hasPieces,
  onOpenSpecial,
  onOpenSecondarySpecial,
  onOpenContent,
  onOpenSecondaryContent,
  onRemove,
  register,
}: {
  fieldId: string;
  index: number;
  colorName: string;
  colorHex: string;
  isDefault: boolean;
  imageUrl: string | undefined;
  secondaryImageUrl: string | undefined;
  error: string | undefined;
  hasPieces: boolean;
  onOpenSpecial: () => void;
  onOpenSecondarySpecial: () => void;
  onOpenContent: () => void;
  onOpenSecondaryContent: () => void;
  onRemove: () => void;
  register: UseFormRegister<SetFormData>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: fieldId });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-lg p-4 bg-white ${isDragging ? 'opacity-50 z-10' : ''}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="w-7 h-7 flex items-center justify-center rounded bg-gray-50 border text-gray-500 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
          title="Arrastrar para reordenar"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <span className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" style={{ backgroundColor: colorHex }} />
        <span className="font-medium text-sm flex-1">{colorName}</span>
        {isDefault && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#F5F5F7] text-gray-600 font-medium">Por defecto</span>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-red-500">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CoverSlot
          label="Portada primaria"
          required
          imageUrl={imageUrl}
          altFieldName={`setColors.${index}.coverAlt`}
          error={error}
          hasPieces={hasPieces}
          onOpenSpecial={onOpenSpecial}
          onOpenContent={onOpenContent}
          register={register}
        />
        <CoverSlot
          label="Portada secundaria"
          imageUrl={secondaryImageUrl}
          altFieldName={`setColors.${index}.secondaryCoverAlt`}
          error={undefined}
          hasPieces={hasPieces}
          onOpenSpecial={onOpenSecondarySpecial}
          onOpenContent={onOpenSecondaryContent}
          register={register}
        />
      </div>
    </div>
  );
}

/**
 * Sección "Portadas por color" (Set × Color) — desacoplada de "Datos generales": cada color de
 * la intersección entre bloques puede tener su propia portada primaria (obligatoria) + secundaria
 * (opcional). El primer color de la lista es el "color por defecto" del set — se reordena por
 * drag-and-drop, sin flag aparte. Depende de que ya existan bloques con piezas (y, en modo MIXED,
 * de los combos ya guardados) para calcular qué colores son elegibles.
 */
export function SetColorsSection({
  register,
  control,
  errors,
  watch,
  setValue,
  setId,
  colorMode,
  blockItems,
  products,
  hasPieces,
  onOpenPicker,
}: SetColorsSectionProps) {
  const { fields, append, remove, move } = useFieldArray({ control, name: 'setColors' });
  const setColors = watch('setColors') ?? [];
  const [colorCombos, setColorCombos] = useState<SetColorComboData[]>([]);

  useEffect(() => {
    if (colorMode !== 'MIXED' || !setId) return;
    let cancelled = false;
    fetch(`/api/admin/sets/${setId}/color-combos`)
      .then((r) => (r.ok ? r.json() : { combos: [] }))
      .then((data) => {
        if (!cancelled) setColorCombos(data.combos || []);
      })
      .catch(() => {
        if (!cancelled) setColorCombos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [colorMode, setId]);

  const availableColors = computeSetColorIntersection(colorMode, blockItems, products, colorCombos);
  const usedColorIds = new Set(setColors.map((c) => c.colorId));
  const selectableColors = availableColors.filter((c) => !usedColorIds.has(c.id));

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    move(oldIndex, newIndex);
    // Reindexar sortOrder según la nueva posición — el primero (0) es el color por defecto.
    const reordered = arrayMove(setColors, oldIndex, newIndex);
    reordered.forEach((_, position) => {
      setValue(`setColors.${position}.sortOrder`, position, { shouldDirty: true });
    });
  }

  function addColor(colorId: string) {
    const color = availableColors.find((c) => c.id === colorId);
    if (!color) return;
    append({
      colorId,
      sortOrder: fields.length,
      coverAssetId: '',
      imageUrl: '',
      coverAlt: '',
      secondaryCoverAssetId: '',
      secondaryImageUrl: '',
      secondaryCoverAlt: '',
    });
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-[#111111] mb-1">Portadas por color</h3>
          <p className="text-sm text-gray-500">
            Elige la imagen de portada (primaria y, opcionalmente, secundaria para el efecto hover)
            para cada color del set. El primer color de la lista es el color por defecto — se
            muestra en el catálogo cuando no hay ningún filtro de color aplicado. Reordena
            arrastrando desde el ícono de la izquierda.
          </p>
        </div>

        {!hasPieces && (
          <p className="text-sm text-amber-600 flex items-start gap-1.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            Agrega piezas a ambos bloques para calcular los colores disponibles.
            <span className="text-[10px] text-gray-400 block">
              DEBUG hasPieces={String(hasPieces)} blockItems={JSON.stringify(blockItems)} productsCount={products.length}
            </span>
          </p>
        )}

        {hasPieces && availableColors.length === 0 && (
          <p className="text-sm text-amber-600 flex items-start gap-1.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {colorMode === 'MIXED'
              ? 'No hay combinaciones de color activas — agrega al menos una en "Piezas del Set mezcladas por color" antes de poder cargar portadas.'
              : 'Las piezas de este set no comparten ningún color en común — no hay colores disponibles para portada.'}
          </p>
        )}

        {errors.setColors?.message && (
          <p className="text-sm text-red-500">{errors.setColors.message as string}</p>
        )}

        {fields.length > 0 && (
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {fields.map((field, index) => {
                  const setColor = setColors[index];
                  const color = availableColors.find((c) => c.id === setColor?.colorId);
                  return (
                    <SetColorRow
                      key={field.id}
                      fieldId={field.id}
                      index={index}
                      colorName={color?.name ?? 'Color desconocido'}
                      colorHex={color?.hex ?? '#ccc'}
                      isDefault={index === 0}
                      imageUrl={setColor?.imageUrl}
                      secondaryImageUrl={setColor?.secondaryImageUrl}
                      error={errors.setColors?.[index]?.coverAssetId?.message}
                      hasPieces={hasPieces}
                      onOpenSpecial={() => onOpenPicker(index, 'cover', 'special')}
                      onOpenSecondarySpecial={() => onOpenPicker(index, 'secondaryCover', 'special')}
                      onOpenContent={() => onOpenPicker(index, 'cover', 'content')}
                      onOpenSecondaryContent={() => onOpenPicker(index, 'secondaryCover', 'content')}
                      onRemove={() => remove(index)}
                      register={register}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {selectableColors.length > 0 && (
          <Select value="" onValueChange={addColor}>
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder="Agregar color..." />
            </SelectTrigger>
            <SelectContent>
              {selectableColors.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full border border-gray-300 inline-block" style={{ backgroundColor: c.hex }} />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {selectableColors.length === 0 && availableColors.length > 0 && fields.length > 0 && (
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Todos los colores disponibles ya tienen una fila.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
