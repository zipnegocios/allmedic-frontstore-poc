'use client';

import type { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * Clases adicionales para el `DialogContent` en desktop (p. ej. para
   * ampliar el ancho máximo por defecto de `sm:max-w-lg`). No afecta mobile.
   */
  contentClassName?: string;
  /**
   * En mobile, hace que el `Drawer` ocupe el alto completo de la pantalla
   * (`100dvh`) en vez del `max-h-[85dvh]` por defecto. Pensado para
   * contenido denso (galerías, formularios largos con muchas secciones).
   */
  mobileFullScreen?: boolean;
}

/**
 * Wrapper que renderiza un `Dialog` en desktop y un `Drawer` inferior en
 * mobile, compartiendo la misma API. Pensado para reutilizarse en fases
 * posteriores al migrar los dialogs existentes del admin.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  contentClassName,
  mobileFullScreen = false,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className={cn(
            mobileFullScreen ? 'h-[100dvh] max-h-[100dvh] rounded-t-none' : 'max-h-[85dvh]'
          )}
        >
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4">{children}</div>
          {footer && <DrawerFooter>{footer}</DrawerFooter>}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-h-[85dvh] flex flex-col overflow-hidden', contentClassName)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
