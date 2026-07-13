'use client';

import { type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { MoreVertical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface AdminListCardAction {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
}

export interface AdminListCardProps {
  /** Ruta a la que navega la tarjeta al ser tocada. Ignorado si se pasa `onNavigate`. */
  href?: string;
  /** Handler custom de navegación/acción principal de la tarjeta. Tiene prioridad sobre `href`. */
  onNavigate?: () => void;
  /** Miniatura opcional (imagen, ícono, avatar) alineada a la izquierda. */
  thumbnail?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Badges informativos (estado, etiquetas). No detienen la navegación al tocarlos. */
  badges?: ReactNode;
  /** Fila de metadatos secundarios (montos, cantidades, fechas). */
  meta?: ReactNode;
  /**
   * Control interactivo embebido en la tarjeta (p. ej. un `Select`). Su toque
   * NO debe disparar la navegación de la tarjeta: se envuelve automáticamente
   * con `stopCardNavigation`.
   */
  inlineControl?: ReactNode;
  /** Acciones secundarias, renderizadas en un menú desplegable (⋮). */
  actions?: AdminListCardAction[];
  className?: string;
  'aria-label'?: string;
}

/**
 * Detiene la propagación de un evento de click/keydown para que no llegue al
 * contenedor tocable de `AdminListCard` (que navega a la ruta de detalle).
 * Se usa para envolver controles interactivos embebidos (Select, botones)
 * que deben permanecer utilizables sin disparar la navegación de la tarjeta.
 */
export function stopCardNavigation(event: { stopPropagation: () => void }): void {
  event.stopPropagation();
}

/**
 * Tarjeta tocable reutilizable para listados admin en mobile (`md:hidden`),
 * equivalente a una fila de `<Table>` en desktop. Comparte el mismo estado y
 * handlers que la vista de tabla — no debe duplicar lógica de fetch.
 */
export function AdminListCard({
  href,
  onNavigate,
  thumbnail,
  title,
  subtitle,
  badges,
  meta,
  inlineControl,
  actions,
  className,
  'aria-label': ariaLabel,
}: AdminListCardProps) {
  const router = useRouter();
  const navigate = onNavigate ?? (href ? () => router.push(href) : undefined);
  const hasActions = !!actions && actions.length > 0;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!navigate) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigate();
    }
  }

  function handleActionsClick(event: MouseEvent<HTMLDivElement>) {
    stopCardNavigation(event);
  }

  return (
    <Card
      role={navigate ? 'button' : undefined}
      tabIndex={navigate ? 0 : undefined}
      aria-label={navigate ? ariaLabel : undefined}
      onClick={navigate}
      onKeyDown={navigate ? handleKeyDown : undefined}
      className={cn(
        'w-full py-0',
        navigate && 'cursor-pointer transition-colors active:bg-gray-50',
        className
      )}
    >
      <CardContent className="flex gap-3 p-4">
        {thumbnail && <div className="shrink-0">{thumbnail}</div>}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-[#111111]">{title}</p>
              {subtitle && <p className="truncate text-sm text-gray-500">{subtitle}</p>}
            </div>
            {hasActions && (
              <div onClick={handleActionsClick} className="shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      aria-label="Más acciones"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {actions!.map((action) => (
                      <DropdownMenuItem
                        key={action.key}
                        variant={action.variant === 'destructive' ? 'destructive' : 'default'}
                        disabled={action.disabled}
                        onSelect={action.onSelect}
                        className="min-h-11"
                      >
                        {action.icon}
                        {action.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {badges && <div className="flex flex-wrap items-center gap-1">{badges}</div>}

          {meta && <div className="text-sm text-gray-500">{meta}</div>}

          {inlineControl && (
            <div onClick={stopCardNavigation} className="pt-0.5">
              {inlineControl}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
