'use client';

import type { Control, FieldErrors, UseFormSetValue } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tag } from 'lucide-react';
import type {
  ProductFormData,
  Brand,
  CollectionOption,
  ProductTypeOption,
  ProductTypeAttributeLink,
  AttributeValueOption,
} from './schema';
import { GENDERS } from './schema';
import { CollapsibleSection } from './CollapsibleSection';
import { AttributeStyleSection } from './AttributeStyleSection';

interface ClassificationSectionProps {
  control: Control<ProductFormData>;
  errors: FieldErrors<ProductFormData>;
  setValue: UseFormSetValue<ProductFormData>;
  brands: Brand[];
  collections: CollectionOption[];
  productTypeOptions: ProductTypeOption[];
  brandIdValue: string;
  productTypeId: string | undefined;
  attributeLinks: ProductTypeAttributeLink[];
  valuesByAttribute: Record<string, AttributeValueOption[]>;
  loadingAttributes: boolean;
  forceOpen?: boolean;
}

/** Marca, Colección, Tipo de Producto, Género y Atributos (Estilos) — agrupados en
 * un acordeón colapsado por defecto (el Código de Estilo, que define el mismo
 * "estilo" del producto, vive fuera de este grupo, siempre visible junto al
 * control de tabs). */
export function ClassificationSection({
  control,
  errors,
  setValue,
  brands,
  collections,
  productTypeOptions,
  brandIdValue,
  productTypeId,
  attributeLinks,
  valuesByAttribute,
  loadingAttributes,
  forceOpen,
}: ClassificationSectionProps) {
  return (
    <CollapsibleSection title="Clasificación" icon={<Tag className="w-4 h-4 text-gray-500" />} forceOpen={forceOpen}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="brandId">Marca *</Label>
          <Controller
            name="brandId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(val) => {
                  field.onChange(val);
                  setValue('collectionId', '');
                  setValue('productTypeId', '');
                }}
              >
                <SelectTrigger id="brandId">
                  <SelectValue placeholder="Seleccionar marca" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id} disabled={!b.isActive}>
                      {b.name}{!b.isActive ? ' (Inactiva)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.brandId && <p className="text-sm text-red-500">{errors.brandId.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="collectionId">Colección</Label>
          <Controller
            name="collectionId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || '__empty__'}
                onValueChange={(val) => field.onChange(val === '__empty__' ? '' : val)}
                disabled={!brandIdValue}
              >
                <SelectTrigger id="collectionId">
                  <SelectValue placeholder="Sin colección" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__empty__">— Sin colección —</SelectItem>
                  {collections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="productTypeId">Tipo de Producto *</Label>
          <Controller
            name="productTypeId"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={!brandIdValue}>
                <SelectTrigger id="productTypeId">
                  <SelectValue placeholder={brandIdValue ? 'Seleccionar tipo de producto' : 'Elige una marca primero'} />
                </SelectTrigger>
                <SelectContent>
                  {productTypeOptions.map((pt) => (
                    <SelectItem key={pt.id} value={pt.id} disabled={!pt.isActive}>
                      {pt.name}{!pt.isActive ? ' (Inactivo)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.productTypeId && <p className="text-sm text-red-500">{errors.productTypeId.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="gender">Género *</Label>
          <Controller
            name="gender"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Seleccionar género" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.gender && <p className="text-sm text-red-500">{errors.gender.message}</p>}
        </div>
      </div>

      <AttributeStyleSection
        control={control}
        productTypeId={productTypeId}
        links={attributeLinks}
        valuesByAttribute={valuesByAttribute}
        loading={loadingAttributes}
      />
    </CollapsibleSection>
  );
}
