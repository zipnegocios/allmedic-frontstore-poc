'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown } from 'lucide-react';

export interface EntityPickerOption {
  id: string;
  label: string;
  sublabel?: string | null;
}

interface EntityPickerProps {
  options: EntityPickerOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
}

/**
 * Combobox genérico Popover+Command para seleccionar una entidad existente (producto, set,
 * etc.) — extraído del patrón duplicado en `set-form/BlockSection.tsx` y
 * `set-form/RecommendedItemsSection.tsx` (2026-07-26). A diferencia de esos dos, no se acopla
 * a `react-hook-form` — expone `value`/`onChange` directo, para usarse en formularios simples
 * (ej. el diálogo de creación de tareas) sin arrastrar `Controller`.
 */
export function EntityPicker({
  options,
  value,
  onChange,
  placeholder = 'Buscar...',
  searchPlaceholder = 'Buscar por nombre o código...',
  emptyLabel = 'Sin resultados.',
}: EntityPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
          {selected ? selected.label : placeholder}
          <ChevronsUpDown className="w-4 h-4 opacity-50 ml-2 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] max-w-[calc(100vw-2rem)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.label} ${option.sublabel ?? ''}`}
                  onSelect={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{option.label}</p>
                    {option.sublabel && <p className="text-xs text-gray-400 truncate">{option.sublabel}</p>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
