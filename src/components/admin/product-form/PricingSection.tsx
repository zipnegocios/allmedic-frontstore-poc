'use client';

import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DollarSign } from 'lucide-react';
import type { ProductFormData } from './schema';
import { CollapsibleSection } from './CollapsibleSection';

interface PricingSectionProps {
  register: UseFormRegister<ProductFormData>;
  errors: FieldErrors<ProductFormData>;
  forceOpen?: boolean;
  /** En el wizard mobile, "Precios" es el único contenido de su propio paso —
   * forzar un colapso ahí agregaría un clic sin beneficio, así que ese caller
   * pasa `defaultOpen`. En desktop se deja colapsado por defecto (`false`). */
  defaultOpen?: boolean;
}

/** Precio Normal/Oferta/Descuento y Precios al Mayor — fusionados en una sola
 * sección colapsable (antes eran dos Cards separadas). */
export function PricingSection({ register, errors, forceOpen, defaultOpen }: PricingSectionProps) {
  return (
    <CollapsibleSection
      title="Precios"
      icon={<DollarSign className="w-4 h-4 text-gray-500" />}
      forceOpen={forceOpen}
      defaultOpen={defaultOpen}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="priceNormal">Precio Normal *</Label>
          <Input id="priceNormal" type="number" step="0.01" inputMode="decimal" {...register('priceNormal')} />
          {errors.priceNormal && <p className="text-sm text-red-500">{errors.priceNormal.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="priceSale">Precio Oferta</Label>
          <Input id="priceSale" type="number" step="0.01" inputMode="decimal" {...register('priceSale')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="discountPct">% Descuento</Label>
          <Input id="discountPct" type="number" min={0} max={100} inputMode="numeric" {...register('discountPct')} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="discountEnd">Fin de descuento</Label>
          <Input id="discountEnd" type="datetime-local" {...register('discountEnd')} />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <h4 className="text-xs font-semibold text-gray-700">Precios al Mayor</h4>
        <p className="text-[11px] text-gray-500 mb-3">
          Usados para calcular el precio referencial de sets corporativos. Opcionales si el producto es &quot;Solo Individual&quot;.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="priceWholesale">Precio al Mayor</Label>
            <Input id="priceWholesale" type="number" step="0.01" inputMode="decimal" {...register('priceWholesale')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="priceWholesaleSale">Precio al Mayor Rebajado</Label>
            <Input id="priceWholesaleSale" type="number" step="0.01" inputMode="decimal" {...register('priceWholesaleSale')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wholesaleDiscountEnd">Fin de rebaja al mayor</Label>
            <Input id="wholesaleDiscountEnd" type="datetime-local" {...register('wholesaleDiscountEnd')} />
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
