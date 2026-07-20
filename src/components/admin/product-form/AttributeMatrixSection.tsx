'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sparkles, Info, Plus } from 'lucide-react';
import type { ProductFormData, Color } from './schema';
import { SIZES } from './schema';
import { AddColorDialog } from './AddColorDialog';
import { CollapsibleSection } from './CollapsibleSection';

// ─── Decisión de diseño (revisión post-Fase 3.4) ───
// Los "Atributos (Estilos)" del Tipo de Producto (ej. Modelo de Terminado, Modelo de
// Corte) se eligen una sola vez en la ficha General (`AttributeStyleSection`): un
// solo valor por atributo, igual para todas las variantes del producto. Este
// generador ya no cruza atributos — solo colores × tallas — y propaga
// `styleAttributes` (recibido como prop) tal cual a cada variante que crea.

interface AttributeMatrixSectionProps {
  productTypeId: string | undefined;
  /** Valores de "Atributos (Estilos)" elegidos en General (attributeId -> valueId) —
   * se copian sin cambios a `attributeValueIds` de cada variante generada. */
  styleAttributes: Record<string, string>;
  colors: Color[];
  variantFields: ProductFormData['variants'][number][];
  appendVariant: (value: Omit<ProductFormData['variants'][number], 'id'> & { id?: string }) => void;
  /** Se dispara al crear un color desde el diálogo "+ Agregar color" — el llamador
   * (`ProductForm`) lo agrega a la lista de colores disponibles en todo el formulario,
   * no solo aquí. */
  onColorCreated?: (color: Color) => void;
  /** Se dispara al terminar de generar la matriz con al menos una variante nueva —
   * el llamador (`VariantsMediaSection`) lo usa para expandir automáticamente la
   * sección "Configuración por Color" del primer color recién generado. */
  onMatrixGenerated?: (colorIds: string[]) => void;
}

export function AttributeMatrixSection({
  productTypeId,
  styleAttributes,
  colors,
  variantFields,
  appendVariant,
  onColorCreated,
  onMatrixGenerated,
}: AttributeMatrixSectionProps) {
  const [selectedColorIds, setSelectedColorIds] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [addColorOpen, setAddColorOpen] = useState(false);

  function handleColorCreated(color: Color) {
    onColorCreated?.(color);
    // Autoseleccionarlo: el caso de uso típico de "+ Agregar color" es que el admin
    // lo necesita YA para la matriz que está armando, no solo para el catálogo general.
    setSelectedColorIds((prev) => [...prev, color.id]);
  }

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  function generateMatrix() {
    if (selectedColorIds.length === 0 || selectedSizes.length === 0) {
      toast.error('Selecciona al menos un color y una talla para generar la matriz');
      return;
    }

    const attributeValueIds = Object.values(styleAttributes).filter(Boolean);

    const existingKeys = new Set(
      variantFields.map((v) => `${v.colorId}|${v.size}`)
    );

    let created = 0;
    for (const colorId of selectedColorIds) {
      for (const size of selectedSizes) {
        const key = `${colorId}|${size}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        // Si el color ya tiene variantes (ej. se agrega una talla nueva a un color
        // existente), hereda su `colorSortOrder` actual — evita que la nueva fila
        // "salte" al inicio del acordeón por quedar en 0 por defecto.
        const existingColorSortOrder = variantFields.find((v) => v.colorId === colorId)?.colorSortOrder ?? 0;
        appendVariant({
          colorId,
          size,
          sku: '',
          status: 'AVAILABLE',
          colorSortOrder: existingColorSortOrder,
          attributeValueIds,
        });
        created += 1;
      }
    }

    if (created === 0) {
      toast.info('No se generaron variantes nuevas (todas las combinaciones ya existían)');
    } else {
      toast.success(`${created} variante(s) generada(s)`);
      onMatrixGenerated?.(selectedColorIds);
    }
  }

  return (
    <CollapsibleSection title="Generador de Matriz de Variantes" icon={<Sparkles className="w-4 h-4 text-gray-500" />}>
      {!productTypeId ? (
        <div className="text-center text-gray-500 text-xs flex flex-col items-center gap-2">
          <Info className="w-5 h-5 text-gray-400" />
          Selecciona un Tipo de Producto en la pestaña General para poder generar la
          matriz de variantes.
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500">
            Elige colores y tallas: se generarán en bloque todas las combinaciones, con
            los Atributos (Estilos) definidos en General. Puedes seguir editando cada
            fila manualmente después.
          </p>

          {/* Colores */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-gray-700">Colores</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddColorOpen(true)}
                className="h-6 text-[10px] px-2 bg-white"
              >
                <Plus className="w-3 h-3 mr-1" />
                Agregar color
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedColorIds((prev) => toggle(prev, c.id))}
                  className={`flex items-center gap-1.5 text-xs border rounded-full px-2.5 py-1 ${
                    selectedColorIds.includes(c.id) ? 'border-[#111111] bg-gray-100' : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full border" style={{ backgroundColor: c.hex }} />
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Tallas */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">Tallas</Label>
            <div className="flex flex-wrap gap-2">
              {SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSizes((prev) => toggle(prev, s))}
                  className={`text-xs border rounded-full px-2.5 py-1 ${
                    selectedSizes.includes(s) ? 'border-[#111111] bg-gray-100' : 'border-gray-200 bg-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <Button type="button" onClick={generateMatrix} className="bg-[#111111]">
            <Sparkles className="w-4 h-4 mr-2" />
            Generar Matriz de Variantes
          </Button>
        </>
      )}

      <AddColorDialog open={addColorOpen} onOpenChange={setAddColorOpen} onCreated={handleColorCreated} />
    </CollapsibleSection>
  );
}
