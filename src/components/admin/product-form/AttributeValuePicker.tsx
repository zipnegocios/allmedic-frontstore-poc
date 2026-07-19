'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AttributeValueOption, ProductTypeAttributeLink } from './schema';
import { SELECT_EMPTY_VALUE } from './schema';

interface AttributeValuePickerProps {
  link: ProductTypeAttributeLink;
  options: AttributeValueOption[];
  value: string | undefined;
  onChange: (value: string) => void;
}

/**
 * Molécula que alterna entre grupo de botones tipo pill y `<Select>` según
 * `link.displayType` ('buttons' | 'select', definido en `/admin/atributos`) —
 * selección única (un solo valor por atributo), no una lista de toggles.
 */
export function AttributeValuePicker({ link, options, value, onChange }: AttributeValuePickerProps) {
  if (link.displayType === 'buttons') {
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(value === option.id ? '' : option.id)}
            className={`text-xs border rounded-full px-2.5 py-1 ${
              value === option.id ? 'border-[#111111] bg-gray-100' : 'border-gray-200 bg-white'
            }`}
          >
            {option.value}
          </button>
        ))}
      </div>
    );
  }

  return (
    <Select
      value={value || SELECT_EMPTY_VALUE}
      onValueChange={(val) => onChange(val === SELECT_EMPTY_VALUE ? '' : val)}
    >
      <SelectTrigger className="h-8 text-xs bg-white w-64">
        <SelectValue placeholder={`Elegir ${link.attributeName}`} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SELECT_EMPTY_VALUE}>— {link.attributeName} —</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>{option.value}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
