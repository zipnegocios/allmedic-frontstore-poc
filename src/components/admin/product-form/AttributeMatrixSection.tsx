'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Info } from 'lucide-react';
import Link from 'next/link';
import type { ProductFormData, Color, ProductTypeAttributeLink, AttributeValueOption } from './schema';
import { SIZES } from './schema';

// ─── Decisión de diseño (Fase 3.4, ver brief D.2) ───
// Por cada atributo declarado para el Tipo de Producto elegido, el admin marca uno
// de dos modos:
//   - "Varía por variante": el admin elige uno o más valores (checkboxes); el
//     generador cruza esos valores en el producto cartesiano junto con colores y
//     tallas (ej. "Corte": Petite + Regular + Tall -> 3x más variantes).
//   - "Fijo para todo el estilo": el admin elige UN valor (select); ese mismo valor
//     se propaga a TODAS las variantes generadas sin multiplicar la matriz (ej.
//     "Tipo de Cuello: Cuello V" aplica igual a todas).
// Por defecto cada atributo arranca en modo "Varía por variante" sin valores
// seleccionados (no genera nada hasta que el admin elige explícitamente), evitando
// que la primera generación incluya atributos que el admin no quiso tocar.

type AttributeMode = 'fixed' | 'varying';

// ─── Validación de atributos requeridos (hallazgo de revisión, Fase 3.4) ───
// `productTypeAttributes.isRequired` no bloqueaba nada antes: se mostraba el badge
// "Requerido" pero se podía generar/guardar una matriz sin asignarle valor. Esta
// función pura calcula qué atributos requeridos del tipo de producto seleccionado
// no tienen todavía un valor asignado (ni "fijo para todo el estilo" ni al menos
// una opción marcada como "varía"), para bloquear la generación de la matriz.
export function getMissingRequiredAttributes(
  links: ProductTypeAttributeLink[],
  modeByAttribute: Record<string, AttributeMode>,
  fixedValueByAttribute: Record<string, string>,
  varyingValuesByAttribute: Record<string, string[]>
): ProductTypeAttributeLink[] {
  return links.filter((link) => {
    if (!link.isRequired) return false;
    const mode = modeByAttribute[link.attributeId] ?? 'varying';
    if (mode === 'fixed') {
      return !fixedValueByAttribute[link.attributeId];
    }
    return (varyingValuesByAttribute[link.attributeId] ?? []).length === 0;
  });
}

interface AttributeMatrixSectionProps {
  productTypeId: string | undefined;
  links: ProductTypeAttributeLink[];
  valuesByAttribute: Record<string, AttributeValueOption[]>;
  loading: boolean;
  colors: Color[];
  variantFields: ProductFormData['variants'][number][];
  appendVariant: (value: Omit<ProductFormData['variants'][number], 'id'> & { id?: string }) => void;
}

export function AttributeMatrixSection({
  productTypeId,
  links,
  valuesByAttribute,
  loading,
  colors,
  variantFields,
  appendVariant,
}: AttributeMatrixSectionProps) {
  const [selectedColorIds, setSelectedColorIds] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [modeByAttribute, setModeByAttribute] = useState<Record<string, AttributeMode>>({});
  const [fixedValueByAttribute, setFixedValueByAttribute] = useState<Record<string, string>>({});
  const [varyingValuesByAttribute, setVaryingValuesByAttribute] = useState<Record<string, string[]>>({});

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  function modeFor(attributeId: string): AttributeMode {
    return modeByAttribute[attributeId] ?? 'varying';
  }

  function generateMatrix() {
    if (selectedColorIds.length === 0 || selectedSizes.length === 0) {
      toast.error('Selecciona al menos un color y una talla para generar la matriz');
      return;
    }

    const missingRequired = getMissingRequiredAttributes(
      links,
      modeByAttribute,
      fixedValueByAttribute,
      varyingValuesByAttribute
    );
    if (missingRequired.length > 0) {
      toast.error(
        `Falta asignar valor al atributo requerido: ${missingRequired
          .map((l) => l.attributeName)
          .join(', ')}`
      );
      return;
    }

    const fixedIds = links
      .filter((link) => modeFor(link.attributeId) === 'fixed')
      .map((link) => fixedValueByAttribute[link.attributeId])
      .filter((id): id is string => !!id);

    const varyingGroups = links
      .filter((link) => modeFor(link.attributeId) === 'varying')
      .map((link) => varyingValuesByAttribute[link.attributeId] ?? [])
      .filter((group) => group.length > 0);

    // Producto cartesiano de los grupos "varía por variante" (sin grupos -> un combo vacío).
    let combos: string[][] = [[]];
    for (const group of varyingGroups) {
      const next: string[][] = [];
      for (const combo of combos) {
        for (const valueId of group) next.push([...combo, valueId]);
      }
      combos = next;
    }

    const existingKeys = new Set(
      variantFields.map(
        (v) => `${v.colorId}|${v.size}|${[...(v.attributeValueIds || [])].sort().join(',')}`
      )
    );

    let created = 0;
    for (const colorId of selectedColorIds) {
      for (const size of selectedSizes) {
        for (const combo of combos) {
          const attributeValueIds = [...fixedIds, ...combo];
          const key = `${colorId}|${size}|${[...attributeValueIds].sort().join(',')}`;
          if (existingKeys.has(key)) continue;
          existingKeys.add(key);
          appendVariant({
            colorId,
            size,
            sku: '',
            status: 'AVAILABLE',
            stock: 0,
            minStock: 5,
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
  }

  if (!productTypeId) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center text-gray-500 text-xs flex flex-col items-center gap-2">
          <Info className="w-5 h-5 text-gray-400" />
          Selecciona un Tipo de Producto en la pestaña General para poder generar la
          matriz de variantes con sus atributos.
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center text-gray-400 text-xs">
          Cargando atributos del tipo de producto...
        </CardContent>
      </Card>
    );
  }

  if (links.length === 0) {
    return (
      <Card className="border-dashed border-amber-300 bg-amber-50/50">
        <CardContent className="p-6 text-center text-amber-800 text-xs flex flex-col items-center gap-2">
          <Info className="w-5 h-5" />
          <p>
            Este Tipo de Producto no tiene atributos configurados todavía, así que no
            hay estilos que ofrecer para generar variantes.
          </p>
          <Link href="/admin/atributos" className="underline font-semibold">
            Ir a Atributos para crear y asociar atributos a este tipo de producto
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-gray-200">
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-[#111111]">Generador de Matriz de Variantes</h3>
        </div>
        <p className="text-xs text-gray-500 -mt-3">
          Elige colores, tallas y valores de atributos: se generarán en bloque todas
          las combinaciones. Puedes seguir editando cada fila manualmente después.
        </p>

        {/* Colores */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-gray-700">Colores</Label>
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

        {/* Atributos del tipo de producto */}
        <div className="space-y-3">
          {links.map((link) => {
            const options = valuesByAttribute[link.attributeId] ?? [];
            const mode = modeFor(link.attributeId);
            return (
              <div key={link.attributeId} className="border rounded-lg p-3 space-y-2 bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                    {link.attributeName}
                    {link.isRequired && <Badge variant="secondary" className="text-[9px]">Requerido</Badge>}
                  </Label>
                  <div className="flex gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setModeByAttribute((prev) => ({ ...prev, [link.attributeId]: 'varying' }))}
                      className={`px-2 py-1 rounded ${mode === 'varying' ? 'bg-[#111111] text-white' : 'bg-white border text-gray-600'}`}
                    >
                      Varía por variante
                    </button>
                    <button
                      type="button"
                      onClick={() => setModeByAttribute((prev) => ({ ...prev, [link.attributeId]: 'fixed' }))}
                      className={`px-2 py-1 rounded ${mode === 'fixed' ? 'bg-[#111111] text-white' : 'bg-white border text-gray-600'}`}
                    >
                      Fijo para todo el estilo
                    </button>
                  </div>
                </div>

                {options.length === 0 ? (
                  <p className="text-[11px] text-gray-400">
                    Este atributo no tiene valores activos configurados en{' '}
                    <Link href="/admin/atributos" className="underline">Atributos</Link>.
                  </p>
                ) : mode === 'fixed' ? (
                  <Select
                    value={fixedValueByAttribute[link.attributeId] || ''}
                    onValueChange={(val) =>
                      setFixedValueByAttribute((prev) => ({ ...prev, [link.attributeId]: val }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs bg-white w-64">
                      <SelectValue placeholder={`Elegir ${link.attributeName}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {options.map((v) => {
                      const checked = (varyingValuesByAttribute[link.attributeId] ?? []).includes(v.id);
                      return (
                        <label key={v.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() =>
                              setVaryingValuesByAttribute((prev) => ({
                                ...prev,
                                [link.attributeId]: toggle(prev[link.attributeId] ?? [], v.id),
                              }))
                            }
                          />
                          {v.value}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Button type="button" onClick={generateMatrix} className="bg-[#111111]">
          <Sparkles className="w-4 h-4 mr-2" />
          Generar Matriz de Variantes
        </Button>
      </CardContent>
    </Card>
  );
}
