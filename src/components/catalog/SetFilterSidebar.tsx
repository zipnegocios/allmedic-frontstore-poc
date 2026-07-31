'use client';

import { X, SlidersHorizontal, Venus, Mars, VenusAndMars, Users } from 'lucide-react';
import type { SetFilterState } from '@/lib/set-filter-logic';
import type { SetFilterOptions } from '@/hooks/useSetFilter';
import type { Gender } from '@/lib/types';
import { ColorSwatch } from './ColorSwatch';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

interface SetFilterSidebarProps {
  filters: SetFilterState;
  filterOptions: SetFilterOptions;
  onFilterChange: (filters: Partial<SetFilterState>) => void;
  isOpen: boolean;
  onClose: () => void;
}

type ArrayFilterKey = 'productTypes' | 'sizes';

const GENDER_OPTIONS: { value: Gender | null; label: string; Icon: typeof Venus }[] = [
  { value: 'Mujer', label: 'Mujer', Icon: Venus },
  { value: 'Hombre', label: 'Hombre', Icon: Mars },
  { value: 'Unisex', label: 'Unisex', Icon: VenusAndMars },
  { value: null, label: 'Todos', Icon: Users },
];

export function SetFilterSidebar({ filters, filterOptions, onFilterChange, isOpen, onClose }: SetFilterSidebarProps) {
  const toggleArrayFilter = (key: ArrayFilterKey, value: string) => {
    const current = filters[key];
    const newValue = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onFilterChange({ [key]: newValue });
  };

  const toggleStyleValue = (slug: string, value: string) => {
    const current = filters.selectedStyles[slug] || [];
    const newValues = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onFilterChange({ selectedStyles: { ...filters.selectedStyles, [slug]: newValues } });
  };

  const clearFilters = () => {
    onFilterChange({
      gender: null,
      productTypes: [],
      brandId: null,
      collectionId: null,
      colorId: null,
      sizes: [],
      selectedStyles: {},
    });
  };

  const toggleColor = (colorId: string) => {
    onFilterChange({ colorId: filters.colorId === colorId ? null : colorId });
  };

  const toggleBrand = (brandId: string) => {
    onFilterChange({ brandId: filters.brandId === brandId ? null : brandId });
  };

  const toggleCollection = (collectionId: string) => {
    onFilterChange({ collectionId: filters.collectionId === collectionId ? null : collectionId });
  };

  const hasActiveFilters =
    filters.gender !== null ||
    filters.productTypes.length > 0 ||
    filters.brandId !== null ||
    filters.collectionId !== null ||
    filters.colorId !== null ||
    filters.sizes.length > 0 ||
    Object.values(filters.selectedStyles).some((values) => values.length > 0);

  const defaultOpenSections = ['gender', 'brand'];

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between p-4 border-b border-[#E5E5E5] lg:hidden">
        <h2 className="text-lg font-semibold">Filtros</h2>
        <button onClick={onClose} className="p-2 hover:bg-[#F5F5F7] rounded-full">
          <X className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="p-4 overflow-y-auto max-h-[calc(100vh-80px)] lg:max-h-none">
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-gray-500 hover:text-[#111111] underline transition-colors mb-4"
          >
            Limpiar todos los filtros
          </button>
        )}

        <Accordion type="multiple" defaultValue={defaultOpenSections} className="w-full">
          <AccordionItem value="gender">
            <AccordionTrigger className="text-xs uppercase tracking-widest text-gray-400 hover:no-underline">
              Género
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-2">
                {GENDER_OPTIONS.map(({ value, label, Icon }) => {
                  const isSelected = filters.gender === value;
                  return (
                    <button
                      key={label}
                      onClick={() => onFilterChange({ gender: value })}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 text-sm rounded border transition-colors duration-150',
                        isSelected
                          ? 'border-[#111111] bg-[#F5F5F7] text-[#111111] font-medium'
                          : 'border-gray-200 text-gray-500 hover:border-gray-400'
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>

          {filterOptions.brands.length > 0 && (
            <AccordionItem value="brand">
              <AccordionTrigger className="text-xs uppercase tracking-widest text-gray-400 hover:no-underline">
                Marca
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-2">
                  {filterOptions.brands.map((brand) => {
                    const isSelected = filters.brandId === brand.id;
                    return (
                      <button
                        key={brand.id}
                        onClick={() => toggleBrand(brand.id)}
                        className={cn(
                          'flex items-center justify-center h-16 px-3 rounded border transition-colors duration-150',
                          isSelected
                            ? 'border-[#111111] bg-[#F5F5F7]'
                            : 'border-gray-200 hover:border-gray-400'
                        )}
                      >
                        {brand.logoUrl ? (
                          <img
                            src={brand.logoUrl}
                            alt={brand.name}
                            className="max-h-10 max-w-full object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <span
                          className={cn(
                            'text-xs font-medium text-center',
                            brand.logoUrl ? 'hidden' : 'block',
                            isSelected ? 'text-[#111111]' : 'text-gray-500'
                          )}
                        >
                          {brand.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {filterOptions.collections.length > 0 && (
            <AccordionItem value="collection">
              <AccordionTrigger className="text-xs uppercase tracking-widest text-gray-400 hover:no-underline">
                Colección
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.collections.map((collection) => {
                    const isSelected = filters.collectionId === collection.id;
                    return (
                      <button
                        key={collection.id}
                        onClick={() => toggleCollection(collection.id)}
                        className={cn(
                          'px-3 py-2 text-xs font-medium rounded border transition-colors duration-150',
                          isSelected
                            ? 'border-[#111111] bg-[#F5F5F7] text-[#111111]'
                            : 'border-gray-200 text-gray-500 hover:border-gray-400'
                        )}
                      >
                        {collection.name}
                      </button>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {filterOptions.productTypes.length > 0 && (
            <AccordionItem value="productType">
              <AccordionTrigger className="text-xs uppercase tracking-widest text-gray-400 hover:no-underline">
                Tipo de Producto
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {filterOptions.productTypes.map((productType) => (
                    <label key={productType} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.productTypes.includes(productType)}
                        onChange={() => toggleArrayFilter('productTypes', productType)}
                        className="w-4 h-4 accent-[#111111] rounded"
                      />
                      <span className="text-sm text-[#333333]">{productType}</span>
                    </label>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {filterOptions.colors.length > 0 && (
            <AccordionItem value="color">
              <AccordionTrigger className="text-xs uppercase tracking-widest text-gray-400 hover:no-underline">
                Color
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.colors.slice(0, 20).map((color) => (
                    <ColorSwatch
                      key={color.id}
                      color={color}
                      isSelected={filters.colorId === color.id}
                      onClick={() => toggleColor(color.id)}
                      size="md"
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {filterOptions.sizes.length > 0 && (
            <AccordionItem value="size">
              <AccordionTrigger className="text-xs uppercase tracking-widest text-gray-400 hover:no-underline">
                Talla
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.sizes.map((size) => {
                    const isSelected = filters.sizes.includes(size);
                    return (
                      <button
                        key={size}
                        onClick={() => toggleArrayFilter('sizes', size)}
                        className={cn(
                          'min-w-[40px] h-9 px-2 text-sm font-medium rounded transition-all duration-200',
                          isSelected
                            ? 'bg-[#111111] text-white'
                            : 'border border-gray-200 text-[#333333] hover:border-[#111111]'
                        )}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Estilos EAV (ej. Corte) — un AccordionItem por cada atributo de estilo presente en
              los datos, no hardcodeado: soporta cualquier atributo que aparezca en `set.availableStyles`. */}
          {filterOptions.styleOptions.map((styleOption) => (
            <AccordionItem key={styleOption.slug} value={`style-${styleOption.slug}`}>
              <AccordionTrigger className="text-xs uppercase tracking-widest text-gray-400 hover:no-underline">
                {styleOption.label}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {styleOption.values.map((value) => (
                    <label key={value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(filters.selectedStyles[styleOption.slug] || []).includes(value)}
                        onChange={() => toggleStyleValue(styleOption.slug, value)}
                        className="w-4 h-4 accent-[#111111] rounded"
                      />
                      <span className="text-sm text-[#333333]">{value}</span>
                    </label>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden lg:block w-[280px] flex-shrink-0">
        <div className="sticky top-20 bg-white border border-[#E5E5E5] rounded-lg">{sidebarContent}</div>
      </aside>

      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden transition-opacity duration-300',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div
          className={cn(
            'absolute left-0 top-0 h-full w-[320px] bg-white shadow-xl transition-transform duration-300',
            isOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {sidebarContent}
        </div>
      </div>
    </>
  );
}

export function SetFilterButton({ onClick, count }: { onClick: () => void; count?: number }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden flex items-center gap-2 px-4 py-2 border border-[#E5E5E5] rounded-full text-sm font-medium hover:border-[#111111] transition-colors"
    >
      <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />
      Filtros
      {count !== undefined && count > 0 && (
        <span className="ml-1 w-5 h-5 bg-[#111111] text-white text-xs rounded-full flex items-center justify-center">
          {count}
        </span>
      )}
    </button>
  );
}
