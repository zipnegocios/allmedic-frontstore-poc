'use client';

import { useState, useEffect } from 'react';
import { X, SlidersHorizontal } from 'lucide-react';
import type { CatalogFilters, Gender, Size, ProductColor } from '@/lib/types';
// Removed dummy colors and brands fallback
import { ColorSwatch } from './ColorSwatch';
import { cn } from '@/lib/utils';

/** Opción de "Tipo de Producto" (EAV) derivada de los productos realmente presentes en el catálogo. */
export interface ProductTypeOption {
  id: string;
  name: string;
}

/** Opción de estilo EAV (ej. "Corte") derivada de `product.availableStyles` — soporta cualquier
 * atributo de estilo presente en los datos, no solo "corte". `label` es el slug capitalizado
 * (no tenemos el `name` del atributo en el payload público, solo su slug estable). */
export interface StyleFilterOption {
  slug: string;
  label: string;
  values: string[];
}

interface FilterSidebarProps {
  filters: CatalogFilters;
  onFilterChange: (filters: CatalogFilters) => void;
  isOpen: boolean;
  onClose: () => void;
  brandNames?: string[];
  availableColors?: ProductColor[];
  /** Opciones de "Tipo de Producto" — derivadas de `product.productType` de los productos cargados. Sin opción muerta. */
  productTypeOptions?: ProductTypeOption[];
  /** Opciones de estilo (ej. "Corte") — derivadas de `product.availableStyles`. Sin opción muerta. */
  styleOptions?: StyleFilterOption[];
}

const sizes: Size[] = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', 'OS'];

export function FilterSidebar({
  filters,
  onFilterChange,
  isOpen,
  onClose,
  brandNames,
  availableColors,
  productTypeOptions,
  styleOptions,
}: FilterSidebarProps) {
  const BRANDS = brandNames || [];
  const AVAILABLE_COLORS = availableColors || [];
  const PRODUCT_TYPES = productTypeOptions || [];
  const STYLE_OPTIONS = styleOptions || [];
  const [localFilters, setLocalFilters] = useState<CatalogFilters>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const updateFilter = <K extends keyof CatalogFilters>(
    key: K,
    value: CatalogFilters[K]
  ) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const toggleArrayFilter = <K extends 'categories' | 'productTypeIds' | 'brands' | 'colors' | 'sizes' | 'fits'>(
    key: K,
    value: string
  ) => {
    const current = localFilters[key] as string[];
    const newValue = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    updateFilter(key, newValue as CatalogFilters[K]);
  };

  const toggleStyleValue = (slug: string, value: string) => {
    const current = localFilters.selectedStyles[slug] || [];
    const newValues = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    const selectedStyles = { ...localFilters.selectedStyles, [slug]: newValues };
    updateFilter('selectedStyles', selectedStyles);
  };

  const clearFilters = () => {
    const emptyFilters: CatalogFilters = {
      gender: null,
      categories: [],
      productTypeIds: [],
      brands: [],
      colors: [],
      sizes: [],
      fits: [],
      selectedStyles: {},
      priceMin: 0,
      priceMax: 200,
    };
    setLocalFilters(emptyFilters);
    onFilterChange(emptyFilters);
  };

  const hasActiveFilters =
    localFilters.gender !== null ||
    localFilters.productTypeIds.length > 0 ||
    localFilters.brands.length > 0 ||
    localFilters.colors.length > 0 ||
    localFilters.sizes.length > 0 ||
    Object.values(localFilters.selectedStyles).some(values => values.length > 0);

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#E5E5E5] lg:hidden">
        <h2 className="text-lg font-semibold">Filtros</h2>
        <button onClick={onClose} className="p-2 hover:bg-[#F5F5F7] rounded-full">
          <X className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-80px)] lg:max-h-none">
        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-gray-500 hover:text-[#111111] underline transition-colors"
          >
            Limpiar todos los filtros
          </button>
        )}

        {/* Gender */}
        <div>
          <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3">Género</h3>
          <div className="space-y-2">
            {(['Mujer', 'Hombre', 'Unisex'] as Gender[]).map(gender => (
              <label key={gender} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  checked={localFilters.gender === gender}
                  onChange={() => updateFilter('gender', gender)}
                  className="w-4 h-4 accent-[#111111]"
                />
                <span className="text-sm text-[#333333]">{gender}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="gender"
                checked={localFilters.gender === null}
                onChange={() => updateFilter('gender', null)}
                className="w-4 h-4 accent-[#111111]"
              />
              <span className="text-sm text-[#333333]">Todos</span>
            </label>
          </div>
        </div>

        {/* Tipo de Producto (EAV) — opciones derivadas de los productos realmente presentes */}
        {PRODUCT_TYPES.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3">Tipo de Producto</h3>
            <div className="space-y-2">
              {PRODUCT_TYPES.map(productType => (
                <label key={productType.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localFilters.productTypeIds.includes(productType.id)}
                    onChange={() => toggleArrayFilter('productTypeIds', productType.id)}
                    className="w-4 h-4 accent-[#111111] rounded"
                  />
                  <span className="text-sm text-[#333333]">{productType.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Brand */}
        <div>
          <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3">Marca</h3>
          <div className="grid grid-cols-2 gap-2">
            {BRANDS.map(brand => {
              const isSelected = localFilters.brands.includes(brand);
              return (
                <button
                  key={brand}
                  onClick={() => toggleArrayFilter('brands', brand)}
                  className={cn(
                    'px-3 py-2 text-xs font-medium rounded border transition-all duration-200 text-left',
                    isSelected
                      ? 'border-[#111111] bg-[#F5F5F7] text-[#111111]'
                      : 'border-gray-200 text-gray-500 hover:border-gray-400'
                  )}
                >
                  {brand}
                </button>
              );
            })}
          </div>
        </div>

        {/* Color */}
        <div>
          <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3">Color</h3>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_COLORS.slice(0, 20).map(color => (
              <ColorSwatch
                key={color.id}
                color={color}
                isSelected={localFilters.colors.includes(color.id)}
                onClick={() => toggleArrayFilter('colors', color.id)}
                size="md"
              />
            ))}
          </div>
        </div>

        {/* Size */}
        <div>
          <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3">Talla</h3>
          <div className="flex flex-wrap gap-2">
            {sizes.map(size => {
              const isSelected = localFilters.sizes.includes(size);
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
        </div>

        {/* Estilos EAV (ej. Corte) — un bloque por cada atributo de estilo presente en los datos,
            no hardcodeado a "corte": soporta cualquier atributo que aparezca en `availableStyles`. */}
        {STYLE_OPTIONS.map(styleOption => (
          <div key={styleOption.slug}>
            <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3">{styleOption.label}</h3>
            <div className="space-y-2">
              {styleOption.values.map(value => (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(localFilters.selectedStyles[styleOption.slug] || []).includes(value)}
                    onChange={() => toggleStyleValue(styleOption.slug, value)}
                    className="w-4 h-4 accent-[#111111] rounded"
                  />
                  <span className="text-sm text-[#333333]">{value}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        {/* Price Range */}
        <div>
          <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3">Precio</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={localFilters.priceMin}
                onChange={(e) => updateFilter('priceMin', Number(e.target.value))}
                placeholder="Min"
                className="w-20 px-2 py-1 text-sm border border-gray-200 rounded"
              />
              <span className="text-gray-400">-</span>
              <input
                type="number"
                value={localFilters.priceMax}
                onChange={(e) => updateFilter('priceMax', Number(e.target.value))}
                placeholder="Max"
                className="w-20 px-2 py-1 text-sm border border-gray-200 rounded"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[280px] flex-shrink-0">
        <div className="sticky top-20 bg-white border border-[#E5E5E5] rounded-lg">
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile Drawer */}
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

export function FilterButton({ onClick, count }: { onClick: () => void; count?: number }) {
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
