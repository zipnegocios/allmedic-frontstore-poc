'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  icon?: ReactNode;
  /** Colapsada por defecto salvo que se indique lo contrario. */
  defaultOpen?: boolean;
  /** Cuando pasa a `true` (ej. tras un intento de guardado fallido con errores
   * dentro de esta sección) fuerza la apertura, aunque el usuario la haya
   * colapsado — mismo criterio que ya usa `VariantsMediaSection` para expandir
   * automáticamente el color con errores. */
  forceOpen?: boolean;
  children: ReactNode;
}

/** Sección colapsable reutilizable — header en forma de botón (título + chevron
 * que rota) que muestra/oculta el contenido. Usada en la ficha General
 * (Clasificación, Precios, Características, Cuidado) y en el Generador de Matriz
 * de Variantes, para reducir scroll y "fatiga visual" en el formulario de producto. */
export function CollapsibleSection({ title, icon, defaultOpen = false, forceOpen = false, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    if (forceOpen) setIsOpen(true);
  }, [forceOpen]);

  return (
    <Card className="border-2 border-gray-200">
      <CardContent className="p-6">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-sm font-semibold text-[#111111]">{title}</h3>
          </div>
          <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
        </button>
        {isOpen && <div className="mt-5 space-y-5">{children}</div>}
      </CardContent>
    </Card>
  );
}
