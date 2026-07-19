'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Save, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export type FloatingSaveStatus = 'idle' | 'saving' | 'success' | 'error';

interface FloatingSaveButtonProps {
  status: FloatingSaveStatus;
  onClick: () => void;
  disabled?: boolean;
  /** `formState.isDirty` del formulario padre — mientras esté en reposo (`idle`),
   * tiñe el fondo de ámbar semitransparente para avisar que hay cambios sin
   * guardar. Se ignora en los demás estados (`saving`/`success`/`error`), que ya
   * tienen su propio color. */
  isDirty?: boolean;
  /** Cuando es `true`, NO aplica `fixed`/`right-*`/`bottom-*` — se renderiza como
   * un botón normal que el padre posiciona con flex/grid. Usado en la barra
   * sticky inferior del wizard mobile (Atrás / Guardar y quedarse / Siguiente),
   * donde el botón ya no flota suelto sino que vive dentro de esa barra. */
  inline?: boolean;
}

/**
 * Botón flotante compacto "Guardar y quedarse" — mismo componente para
 * `ProductForm` (incluido embebido en el drawer de sets) y `SetForm`, para que
 * el comportamiento sea idéntico en los tres contextos. Solo ícono: fondo
 * semitransparente en reposo (ámbar si hay cambios sin guardar, gris si no),
 * azul + check al confirmar guardado (10s) y rojo + X si falla (10s), controlado
 * por el `status` que gestiona el formulario padre.
 */
export function FloatingSaveButton({ status, onClick, disabled, isDirty, inline }: FloatingSaveButtonProps) {
  const isSaving = status === 'saving';
  const isSuccess = status === 'success';
  const isError = status === 'error';
  const isIdle = !isSaving && !isSuccess && !isError;

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled || isSaving}
      size="icon"
      title="Guardar y quedarse"
      aria-label="Guardar y quedarse"
      className={cn(
        'h-11 w-11 rounded-full shadow-lg transition-colors',
        !inline && 'fixed z-40 right-4 md:right-8 bottom-[calc(9rem_+_env(safe-area-inset-bottom))] md:bottom-6',
        isSuccess && 'bg-blue-600 hover:bg-blue-600 text-white',
        isError && 'bg-red-600 hover:bg-red-600 text-white',
        isIdle && isDirty && 'bg-amber-500/50 hover:bg-amber-500/70 text-white',
        isIdle && !isDirty && 'bg-[#111111]/50 hover:bg-[#111111]/70 text-white'
      )}
    >
      {isSaving ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isSuccess ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : isError ? (
        <XCircle className="w-4 h-4" />
      ) : (
        <Save className="w-4 h-4" />
      )}
    </Button>
  );
}
