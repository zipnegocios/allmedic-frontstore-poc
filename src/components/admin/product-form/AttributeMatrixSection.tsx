'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sparkles, Info, Link2 } from 'lucide-react';
import type { ProductFormData, Color, ProductTypeAttributeLink, AttributeValueOption } from './schema';
import { AssociateColorDialog } from '@/components/admin/colors/AssociateColorDialog';
import type { ColorFormValue } from '@/components/admin/colors/ColorFormDialog';
import { CollapsibleSection } from './CollapsibleSection';

// ─── Decisión de diseño (revisión Fase Atributos-como-Variante) ───
// Los atributos del Tipo de Producto en modo INFORMATIVE (ej. Modelo de Terminado en
// Camisa) se siguen eligiendo una sola vez en General (`AttributeStyleSection`) y se
// propagan tal cual vía `styleAttributes`. Los atributos en modo VARIANT (ej. Modelo de
// Corte en Pantalón) ahora son un eje más de este generador: se cruzan junto a
// color × talla, y cada combinación genera su propia fila con su propio
// `attributeValueIds` — el comprador podrá elegir entre ellas en el storefront.

interface AttributeMatrixSectionProps {
  productTypeId: string | undefined;
  /** Marca activa del producto en edición — se propaga al modal de color para que el
   * color recién creado se auto-vincule a ella (picker filtrado estricto por marca),
   * previa confirmación del admin. */
  brandId?: string;
  brandName?: string;
  /** Valores de "Atributos (Estilos)" INFORMATIVE elegidos en General
   * (attributeId -> valueId) — se copian sin cambios a `attributeValueIds` de cada
   * variante generada, junto a los valores VARIANT seleccionados en este componente. */
  styleAttributes: Record<string, string>;
  /** Atributos asociados al tipo de producto (todos los modos) — se filtra aquí a
   * solo `usageMode === 'VARIANT'` para ofrecerlos como eje de la matriz. */
  attributeLinks: ProductTypeAttributeLink[];
  valuesByAttribute: Record<string, AttributeValueOption[]>;
  colors: Color[];
  /** Tallas activas del catálogo global (`/admin/atributos` → Tallas), ya
   * ordenadas — reemplaza la lista fija que existía antes. */
  sizes: string[];
  variantFields: ProductFormData['variants'][number][];
  appendVariant: (value: Omit<ProductFormData['variants'][number], 'id'> & { id?: string }) => void;
  /** Se dispara al asociar (existente o recién creado) un color desde el diálogo
   * "Asociar Color" — el llamador (`ProductForm`) lo agrega a la lista de colores
   * disponibles en todo el formulario, no solo aquí. */
  onColorCreated?: (color: Color) => void;
  /** Se dispara al terminar de procesar la matriz para los colores seleccionados —
   * incluso si no se crearon variantes nuevas (combinaciones ya existentes). El
   * llamador (`VariantsMediaSection`) lo usa para expandir automáticamente la
   * sección "Configuración por Color" del primer color, y para disparar el escaneo
   * de medios sin vincular de esos colores (`getUnlinkedProductMediaByColor`). */
  onMatrixGenerated?: (colorIds: string[]) => void;
}

export function AttributeMatrixSection({
  productTypeId,
  brandId,
  brandName,
  styleAttributes,
  attributeLinks,
  valuesByAttribute,
  colors,
  sizes,
  variantFields,
  appendVariant,
  onColorCreated,
  onMatrixGenerated,
}: AttributeMatrixSectionProps) {
  const [selectedColorIds, setSelectedColorIds] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [associateColorOpen, setAssociateColorOpen] = useState(false);
  // Valores seleccionados por atributo VARIANT (attributeId -> array de valueIds
  // activados para esta matriz) — a diferencia de styleAttributes (un solo valor),
  // aquí se pueden marcar VARIOS valores porque cada uno se convierte en un eje
  // distinto de la matriz (ej. activar "Petite" y "Regular" genera variantes para
  // ambos, no solo uno).
  const [selectedVariantValueIds, setSelectedVariantValueIds] = useState<Record<string, string[]>>({});

  const variantAxisLinks = attributeLinks.filter((link) => link.usageMode === 'VARIANT');

  function toggleVariantValue(attributeId: string, valueId: string) {
    setSelectedVariantValueIds((prev) => {
      const current = prev[attributeId] ?? [];
      const next = current.includes(valueId)
        ? current.filter((v) => v !== valueId)
        : [...current, valueId];
      return { ...prev, [attributeId]: next };
    });
  }

  // Orden alfabético en tiempo real (plan 2026-07-27, decisión 12) — el selector de chips se
  // reordena a medida que se van marcando/agregando colores (ej. "Asociar color" inserta al
  // final del array `colors` recibido por prop), sin esperar a la generación de variantes.
  const sortedColors = [...colors].sort((a, b) => a.name.localeCompare(b.name));

  function handleColorAssociated(color: ColorFormValue) {
    // Asociación de un color existente o alta nueva (ambos flujos de
    // `AssociateColorDialog`) — en ambos casos se refleja en la lista de colores
    // disponibles del formulario completo (`ProductForm`), no solo aquí.
    onColorCreated?.(color as Color);
    // Autoseleccionarlo: el caso de uso típico de "Asociar Color" es que el admin lo
    // necesita YA para la matriz que está armando, no solo para el catálogo de la marca.
    setSelectedColorIds((prev) => (prev.includes(color.id) ? prev : [...prev, color.id]));
  }

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  function generateMatrix() {
    if (selectedColorIds.length === 0 || selectedSizes.length === 0) {
      toast.error('Selecciona al menos un color y una talla para generar la matriz');
      return;
    }

    const informativeValueIds = Object.values(styleAttributes).filter(Boolean);

    // Ejes VARIANT con al menos un valor activado — si un atributo VARIANT no tiene
    // ningún valor marcado en este generador, se omite del cruce (no bloquea la
    // generación de color×talla "planas" para ese eje).
    const variantAxes = variantAxisLinks
      .map((link) => selectedVariantValueIds[link.attributeId] ?? [])
      .filter((values) => values.length > 0);

    // Producto cartesiano de todos los ejes VARIANT activos. Si no hay ningún eje
    // VARIANT con valores seleccionados, `combinations` queda como `[[]]` (una sola
    // combinación vacía) — preserva el comportamiento original de solo color×talla.
    let combinations: string[][] = [[]];
    for (const axisValues of variantAxes) {
      combinations = combinations.flatMap((combo) =>
        axisValues.map((valueId) => [...combo, valueId])
      );
    }

    const existingKeys = new Set(
      variantFields.map((v) => `${v.colorId}|${v.size}|${[...(v.attributeValueIds ?? [])].sort().join(',')}`)
    );

    let created = 0;
    for (const colorId of selectedColorIds) {
      for (const size of selectedSizes) {
        for (const variantCombo of combinations) {
          const attributeValueIds = [...informativeValueIds, ...variantCombo];
          const key = `${colorId}|${size}|${[...attributeValueIds].sort().join(',')}`;
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
    }

    if (created === 0) {
      toast.info('No se generaron variantes nuevas (todas las combinaciones ya existían)');
    } else {
      toast.success(`${created} variante(s) generada(s)`);
    }
    // Se dispara aunque `created === 0` (combinaciones ya existentes) — cubre el caso de
    // reabrir un producto con variantes ya guardadas pero cuyos medios nunca se vincularon
    // (ej. sesión previa que falló al guardar), donde regenerar la matriz no crea filas
    // nuevas pero sigue siendo la señal de "quiero revisar estos colores".
    onMatrixGenerated?.(selectedColorIds);
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
                onClick={() => setAssociateColorOpen(true)}
                disabled={!brandId}
                title={!brandId ? 'Selecciona una marca en General primero' : undefined}
                className="h-6 text-[10px] px-2 bg-white"
              >
                <Link2 className="w-3 h-3 mr-1" />
                Asociar color
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {sortedColors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedColorIds((prev) => toggle(prev, c.id))}
                  className={`flex items-center gap-1.5 text-xs border rounded-full px-2.5 py-1 ${
                    selectedColorIds.includes(c.id) ? 'border-[#111111] bg-gray-100' : 'border-gray-200 bg-white'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full border"
                    style={{
                      backgroundColor: c.hex,
                      backgroundImage: c.kind === 'PATTERN' && c.swatchUrl ? `url(${c.swatchUrl})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Tallas */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">Tallas</Label>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => (
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

          {/* Ejes de atributos VARIANT (ej. Modelo de Corte) */}
          {variantAxisLinks.map((link) => {
            const options = valuesByAttribute[link.attributeId] ?? [];
            const selected = selectedVariantValueIds[link.attributeId] ?? [];
            if (options.length === 0) {
              return (
                <p key={link.attributeId} className="text-[11px] text-gray-400">
                  {link.attributeName}: sin valores activos configurados en{' '}
                  <Link href="/admin/atributos" className="underline">Atributos</Link>.
                </p>
              );
            }
            return (
              <div key={link.attributeId} className="space-y-2">
                <Label className="text-xs font-semibold text-gray-700">
                  {link.attributeName} <span className="text-gray-400 font-normal">(elige los valores a ofrecer)</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleVariantValue(link.attributeId, opt.id)}
                      className={`text-xs border rounded-full px-2.5 py-1 ${
                        selected.includes(opt.id) ? 'border-[#111111] bg-gray-100' : 'border-gray-200 bg-white'
                      }`}
                    >
                      {opt.value}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          <Button type="button" onClick={generateMatrix} className="bg-[#111111]">
            <Sparkles className="w-4 h-4 mr-2" />
            Generar Matriz de Variantes
          </Button>
        </>
      )}

      {brandId && (
        <AssociateColorDialog
          open={associateColorOpen}
          onOpenChange={setAssociateColorOpen}
          brandId={brandId}
          brandName={brandName}
          onAssociated={handleColorAssociated}
        />
      )}
    </CollapsibleSection>
  );
}
