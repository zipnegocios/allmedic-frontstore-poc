'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';

interface TagListEditorProps {
  /** Título de la sección (ej. "Características"). Omitir si el título ya
   * se muestra en un contenedor externo (ej. un `AccordionTrigger`). */
  title?: string;
  placeholder: string;
  values: string[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

/**
 * Editor de lista de tags libres (agregar por Enter/botón, quitar con
 * click). Usado 3 veces en `ProductForm` (Características, Instrucciones de
 * Cuidado, Estilos) tanto en la vista desktop (Tabs) como en el wizard
 * mobile — mismo componente, sin duplicar markup.
 */
export function TagListEditor({
  title,
  placeholder,
  values,
  inputValue,
  onInputChange,
  onAdd,
  onRemove,
}: TagListEditorProps) {
  return (
    <div className="space-y-4">
      {title && <h3 className="font-semibold">{title}</h3>}
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAdd())}
        />
        <Button type="button" variant="outline" onClick={onAdd}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {values.map((v, i) => (
          <Badge key={i} variant="secondary" className="gap-1">
            {v}
            <button type="button" onClick={() => onRemove(i)} className="ml-1 hover:text-red-500">
              <Trash2 className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}
