'use client';

import { X, SlidersHorizontal } from 'lucide-react';
import type { SetFilterState } from '@/lib/set-filter-logic';
import type { SetFilterOptions } from '@/hooks/useSetFilter';
import type { Gender } from '@/lib/types';
import { ColorSwatch } from './ColorSwatch';
import { cn } from '@/lib/utils';

interface SetFilterSidebarProps {
  filters: SetFilterState;
  filterOptions: SetFilterOptions;
  onFilterChange: (filters: Partial<SetFilterState>) => void;
  isOpen: boolean;
  onClose: () => void;
}

type ArrayFilterKey = 'groups' | 'categories' | 'brands' | 'colors' | 'sizes' | 'fits';

export function SetFilterSidebar({ filters, filterOptions, onFilterChange, isOpen, onClose }: SetFilterSidebarProps) {
  const toggleArrayFilter = (key: ArrayFilterKey, value: string) => {
    const current = filters[key];
    const newValue = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onFilterChange({ [key]: newValue });
  };

  const clearFilters = () => {
    onFilterChange({ groups: [], gender: null, categories: [], brands: [], colors: [], sizes: [], fits: [] });
  };

  const hasActiveFilters =
    filters.groups.length > 0 ||
    filters.gender !== null ||
    filters.categories.length > 0 ||
    filters.brands.length > 0 ||
    filters.colors.length > 0 ||
    filters.sizes.length > 0 ||
    filters.fits.length > 0;

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between p-4 border-b border-[#E5E5E5] lg:hidden">
        <h2 className="text-lg font-semibold">Filtros</h2>
        <button onClick={onClose} className="p-2 hover:bg-[#F5F5F7] rounded-full">
          <X className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-80px)] lg:max-h-none">
        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-[#111111] underline transition-colors">
            Limpiar todos los filtros
          </button>
        )}

        {filterOptions.groups.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3">Grupo</h3>
            <div className="space-y-2">
              {filterOptions.groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.groups.includes(g.slug)}
                    onChange={() => toggleArrayFilter('groups', g.slug)}
                    className="w-4 h-4 accent-[#111111] rounded"
                  />
                  <span className="text-sm text-[#333333]">{g.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3">Género</h3>
          <div className="space-y-2">
            {(['Mujer', 'Hombre', 'Unisex'] as Gender[]).map((gender) => (
              <label key={gender} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="set-gender"
                  checked={filters.gender === gender}
                  onChange={() => onFilterChange({ gender })}
                  className="w-4 h-4 accent-[#111111]"
                />
                <span className="text-sm text-[#333333]">{gender}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="set-gender"
                checked={filters.gender === null}
                onChange={() => onFilterChange({ gender: null })}
                className="w-4 h-4 accent-[#111111]"
              />
              <span className="text-sm text-[#333333]">Todos</span>
            </label>
          </div>
        </div>

        {filterOptions.categories.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3">Categoría</h3>
            <div className="space-y-2">
              {filterOptions.categories.map((category) => (
                <label key={category} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.categories.includes(category)}
                    onChange={() => toggleArrayFilter('categories', category)}
                    className="w-4 h-4 accent-[#111111] rounded"
                  />
                  <span className="text-sm text-[#333333]">{category}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {filterOptions.brands.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3">Marca</h3>
            <div className="grid grid-cols-2 gap-2">
              {filterOptions.brands.map((brand) => {
                const isSelected = filters.brands.includes(brand);
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
        )}

        {filterOptions.colors.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3">Color</h3>
            <div className="flex flex-wrap gap-2">
              {filterOptions.colors.slice(0, 20).map((color) => (
                <ColorSwatch
                  key={color.id}
                  color={color}
                  isSelected={filters.colors.includes(color.id)}
                  onClick={() => toggleArrayFilter('colors', color.id)}
                  size="md"
                />
              ))}
            </div>
          </div>
        )}

        {filterOptions.sizes.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3">Talla</h3>
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
          </div>
        )}

        {filterOptions.fits.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3">Corte</h3>
            <div className="space-y-2">
              {filterOptions.fits.map((fit) => (
                <label key={fit} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.fits.includes(fit)}
                    onChange={() => toggleArrayFilter('fits', fit)}
                    className="w-4 h-4 accent-[#111111] rounded"
                  />
                  <span className="text-sm text-[#333333]">{fit}</span>
                </label>
              ))}
            </div>
          </div>
        )}
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
