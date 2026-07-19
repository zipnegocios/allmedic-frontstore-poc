'use client';

import { Controller, type Control } from 'react-hook-form';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Info, Palette } from 'lucide-react';
import Link from 'next/link';
import type { AttributeValueOption, ProductFormData, ProductTypeAttributeLink } from './schema';
import { AttributeValuePicker } from './AttributeValuePicker';

/** Atributos "Estilo" requeridos por el Tipo de Producto sin valor elegido — usado
 * para mostrar una advertencia inline en la sección (no bloquea el guardado, igual
 * que el comportamiento previo del generador de matriz). */
export function getMissingRequiredStyleAttributes(
  links: ProductTypeAttributeLink[],
  styleAttributes: Record<string, string>
): ProductTypeAttributeLink[] {
  return links.filter((link) => link.isRequired && !styleAttributes[link.attributeId]);
}

interface AttributeStyleSectionProps {
  control: Control<ProductFormData>;
  productTypeId: string | undefined;
  links: ProductTypeAttributeLink[];
  valuesByAttribute: Record<string, AttributeValueOption[]>;
  loading: boolean;
}

/**
 * Selector de "Atributos (Estilos)" del Tipo de Producto — global al producto (un
 * solo valor por atributo, el mismo para todas sus variantes/colores), ubicado en
 * la ficha General justo después de "Código de Estilo".
 */
export function AttributeStyleSection({
  control,
  productTypeId,
  links,
  valuesByAttribute,
  loading,
}: AttributeStyleSectionProps) {
  if (!productTypeId) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 text-center text-gray-500 text-xs flex flex-col items-center gap-2">
          <Info className="w-4 h-4 text-gray-400" />
          Selecciona un Tipo de Producto para poder definir los Atributos (Estilos).
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 text-center text-gray-400 text-xs">
          Cargando atributos del tipo de producto...
        </CardContent>
      </Card>
    );
  }

  if (links.length === 0) {
    return (
      <Card className="border-dashed border-amber-300 bg-amber-50/50">
        <CardContent className="p-4 text-center text-amber-800 text-xs flex flex-col items-center gap-2">
          <Info className="w-4 h-4" />
          <p>Este Tipo de Producto no tiene atributos configurados todavía.</p>
          <Link href="/admin/atributos" className="underline font-semibold">
            Ir a Atributos para crear y asociar atributos a este tipo de producto
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
        <Palette className="w-3.5 h-3.5" />
        Atributos (Estilos)
      </Label>
      <Controller
        name="styleAttributes"
        control={control}
        render={({ field }) => (
          <div className="space-y-3">
            {links.map((link) => {
              const options = valuesByAttribute[link.attributeId] ?? [];
              const currentValue = field.value?.[link.attributeId];
              return (
                <div key={link.attributeId} className="border rounded-lg p-3 space-y-2 bg-gray-50/50">
                  <Label className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                    {link.attributeName}
                    {link.isRequired && <Badge variant="secondary" className="text-[9px]">Requerido</Badge>}
                  </Label>
                  {options.length === 0 ? (
                    <p className="text-[11px] text-gray-400">
                      Este atributo no tiene valores activos configurados en{' '}
                      <Link href="/admin/atributos" className="underline">Atributos</Link>.
                    </p>
                  ) : (
                    <AttributeValuePicker
                      link={link}
                      options={options}
                      value={currentValue}
                      onChange={(val) =>
                        field.onChange({ ...field.value, [link.attributeId]: val })
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      />
    </div>
  );
}
