'use client';

import type { UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SetFormData } from './schema';

interface PricePreview {
  total: number;
  hasMissing: boolean;
}

interface PriceSectionProps {
  register: UseFormRegister<SetFormData>;
  manualPriceEnabled: boolean;
  setManualPriceEnabled: (enabled: boolean) => void;
  pricePreview: PricePreview;
  deltaPct: number | null;
}

/**
 * Contenido de "Precio del set (híbrido)": precio manual vs. calculado desde
 * piezas. Extraído para reutilizarse sin cambios tanto en la vista desktop
 * (Card secuencial) como en el paso 3 del wizard mobile.
 */
export function PriceSection({ register, manualPriceEnabled, setManualPriceEnabled, pricePreview, deltaPct }: PriceSectionProps) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Precio del set</h3>
            <p className="text-xs text-gray-500">
              Por defecto el precio es automático: suma del precio mínimo de cada bloque × su cantidad ("Desde $X").
              Actívalo para fijar un precio propio del set.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={manualPriceEnabled} onCheckedChange={setManualPriceEnabled} />
            <Label>Fijar precio manual del set</Label>
          </div>
        </div>

        {manualPriceEnabled && (
          <div className="space-y-3 pt-2 border-t border-[#E5E5E5]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priceManual">Precio manual</Label>
                <Input id="priceManual" type="number" step="0.01" inputMode="decimal" {...register('priceManual')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceManualSale">Precio manual rebajado</Label>
                <Input id="priceManualSale" type="number" step="0.01" inputMode="decimal" {...register('priceManualSale')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manualDiscountEnd">Fin de la rebaja</Label>
                <Input id="manualDiscountEnd" type="datetime-local" {...register('manualDiscountEnd')} />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
              <span className="text-gray-500">Desde $X automático (mínimo por bloque × cantidad)</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">${pricePreview.total.toFixed(2)}</span>
                {deltaPct !== null && (
                  <Badge variant={deltaPct < 0 ? 'default' : 'secondary'}>
                    {deltaPct > 0 ? '+' : ''}{deltaPct}% vs. suma automática
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
