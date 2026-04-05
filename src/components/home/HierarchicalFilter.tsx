'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, SlidersHorizontal, Check } from 'lucide-react';
import type { FilterState, FilterOptions } from '@/hooks/useProductFilter';
import { cn } from '@/lib/utils';

interface HierarchicalFilterProps {
  filters: FilterState;
  filterOptions: FilterOptions;
  onFilterChange: (filters: Partial<FilterState>) => void;
  onReset: () => void;
  activeFilterCount: number;
  hasActiveFilters: boolean;
}

interface FilterDropdownProps {
  label: string;
  value: string | null | undefined;
  options: { value: string; label: string; color?: string }[];
  onSelect: (value: string | null) => void;
  placeholder?: string;
  isColor?: boolean;
}

function FilterDropdown({ label, value, options, onSelect, placeholder, isColor }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg border transition-all duration-200',
          value
            ? 'bg-[#111111] text-white border-[#111111]'
            : 'bg-white text-[#333333] border-[#E5E5E5] hover:border-[#111111]'
        )}
      >
        <span className="flex items-center gap-2">
          {isColor && selectedOption?.color && (
            <span
              className="w-4 h-4 rounded-full border border-white/30"
              style={{ backgroundColor: selectedOption.color }}
            />
          )}
          <span className="text-xs uppercase tracking-wider text-gray-400 mr-1">{label}:</span>
          <span className="truncate max-w-[100px]">{selectedOption?.label || placeholder || `Todos`}</span>
        </span>
        <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} strokeWidth={1.5} />
      </button>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-[#E5E5E5] overflow-hidden">
          <div className="max-h-64 overflow-y-auto py-2">
            <button
              onClick={() => {
                onSelect(null);
                setIsOpen(false);
              }}
              className={cn(
                'w-full px-4 py-2.5 text-left text-sm hover:bg-[#F5F5F7] transition-colors flex items-center justify-between',
                !value && 'bg-[#F5F5F7] font-medium'
              )}
            >
              Todos
              {!value && <Check className="w-4 h-4" strokeWidth={1.5} />}
            </button>
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onSelect(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full px-4 py-2.5 text-left text-sm hover:bg-[#F5F5F7] transition-colors flex items-center justify-between',
                  value === option.value && 'bg-[#F5F5F7] font-medium'
                )}
              >
                <span className="flex items-center gap-2">
                  {isColor && option.color && (
                    <span
                      className="w-4 h-4 rounded-full border border-gray-200"
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  {option.label}
                </span>
                {value === option.value && <Check className="w-4 h-4" strokeWidth={1.5} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function HierarchicalFilter({
  filters,
  filterOptions,
  onFilterChange,
  onReset,
  activeFilterCount,
  hasActiveFilters,
}: HierarchicalFilterProps) {
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const categoryOptions = filterOptions.categories.map(c => ({ value: c, label: c }));
  const sizeOptions = filterOptions.sizes.map(s => ({ value: s, label: s }));
  const colorOptions = filterOptions.colors.map(c => ({ value: c.id, label: c.name, color: c.hex }));
  const brandOptions = filterOptions.brands.map(b => ({ value: b, label: b }));
  const collectionOptions = filterOptions.collections.map(c => ({ value: c, label: c }));
  const styleOptions = filterOptions.styles.map(s => ({ value: s, label: s }));
  const fitOptions = filterOptions.fits.map(f => ({ value: f, label: f }));

  const FilterContent = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      <FilterDropdown
        label="Categoría"
        value={filters.category}
        options={categoryOptions}
        onSelect={(v) => onFilterChange({ category: v as any })}
        placeholder="Todas"
      />
      <FilterDropdown
        label="Talla"
        value={filters.size}
        options={sizeOptions}
        onSelect={(v) => onFilterChange({ size: v as any })}
        placeholder="Todas"
      />
      <FilterDropdown
        label="Color"
        value={filters.color}
        options={colorOptions}
        onSelect={(v) => onFilterChange({ color: v })}
        placeholder="Todos"
        isColor
      />
      <FilterDropdown
        label="Marca"
        value={filters.brand}
        options={brandOptions}
        onSelect={(v) => onFilterChange({ brand: v })}
        placeholder="Todas"
      />
      <FilterDropdown
        label="Colección"
        value={filters.collection}
        options={collectionOptions}
        onSelect={(v) => onFilterChange({ collection: v })}
        placeholder="Todas"
      />
      <FilterDropdown
        label="Estilo"
        value={filters.style}
        options={styleOptions}
        onSelect={(v) => onFilterChange({ style: v })}
        placeholder="Todos"
      />
      <FilterDropdown
        label="Corte"
        value={filters.fit}
        options={fitOptions}
        onSelect={(v) => onFilterChange({ fit: v as any })}
        placeholder="Todos"
      />
    </div>
  );

  return (
    <div className="bg-white">
      {/* Desktop Filters */}
      <div className="hidden lg:block">
        <FilterContent />
      </div>

      {/* Mobile Filter Button */}
      <div className="lg:hidden">
        <button
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all duration-200',
            hasActiveFilters
              ? 'bg-[#111111] text-white border-[#111111]'
              : 'bg-white text-[#333333] border-[#E5E5E5] hover:border-[#111111]'
          )}
        >
          <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />
          <span className="text-sm font-medium">
            {hasActiveFilters ? `Filtros (${activeFilterCount})` : 'Filtrar productos'}
          </span>
        </button>

        {/* Mobile Filter Drawer */}
        {showMobileFilters && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div 
              className="absolute inset-0 bg-black/50" 
              onClick={() => setShowMobileFilters(false)}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Filtrar productos</h3>
                <button 
                  onClick={() => setShowMobileFilters(false)}
                  className="p-2 hover:bg-[#F5F5F7] rounded-full"
                >
                  <X className="w-5 h-5" strokeWidth={1.5} />
                </button>
              </div>
              <div className="space-y-4">
                <FilterContent />
              </div>
              <div className="mt-6 pt-4 border-t border-[#E5E5E5]">
                <button
                  onClick={() => {
                    onReset();
                    setShowMobileFilters(false);
                  }}
                  className="w-full py-3 text-sm font-medium text-gray-500 hover:text-[#111111] transition-colors"
                >
                  Limpiar todos los filtros
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Filters Tags */}
      {hasActiveFilters && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-400 uppercase tracking-wider">Activos:</span>
          {filters.category && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#F5F5F7] rounded-full text-sm">
              Categoría: {filters.category}
              <button onClick={() => onFilterChange({ category: null })} className="hover:text-[#FF3B30]">
                <X className="w-3 h-3" strokeWidth={1.5} />
              </button>
            </span>
          )}
          {filters.size && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#F5F5F7] rounded-full text-sm">
              Talla: {filters.size}
              <button onClick={() => onFilterChange({ size: null })} className="hover:text-[#FF3B30]">
                <X className="w-3 h-3" strokeWidth={1.5} />
              </button>
            </span>
          )}
          {filters.color && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#F5F5F7] rounded-full text-sm">
              Color: {filterOptions.colors.find(c => c.id === filters.color)?.name}
              <button onClick={() => onFilterChange({ color: null })} className="hover:text-[#FF3B30]">
                <X className="w-3 h-3" strokeWidth={1.5} />
              </button>
            </span>
          )}
          {filters.brand && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#F5F5F7] rounded-full text-sm">
              Marca: {filters.brand}
              <button onClick={() => onFilterChange({ brand: null })} className="hover:text-[#FF3B30]">
                <X className="w-3 h-3" strokeWidth={1.5} />
              </button>
            </span>
          )}
          {filters.collection && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#F5F5F7] rounded-full text-sm">
              Colección: {filters.collection}
              <button onClick={() => onFilterChange({ collection: null })} className="hover:text-[#FF3B30]">
                <X className="w-3 h-3" strokeWidth={1.5} />
              </button>
            </span>
          )}
          {filters.style && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#F5F5F7] rounded-full text-sm">
              Estilo: {filters.style}
              <button onClick={() => onFilterChange({ style: null })} className="hover:text-[#FF3B30]">
                <X className="w-3 h-3" strokeWidth={1.5} />
              </button>
            </span>
          )}
          {filters.fit && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#F5F5F7] rounded-full text-sm">
              Corte: {filters.fit}
              <button onClick={() => onFilterChange({ fit: null })} className="hover:text-[#FF3B30]">
                <X className="w-3 h-3" strokeWidth={1.5} />
              </button>
            </span>
          )}
          <button
            onClick={onReset}
            className="text-sm text-[#FF3B30] hover:underline ml-2"
          >
            Limpiar todo
          </button>
        </div>
      )}
    </div>
  );
}
