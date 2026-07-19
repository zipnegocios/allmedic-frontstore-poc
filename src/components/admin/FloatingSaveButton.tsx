'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Save, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export type FloatingSaveStatus = 'idle' | 'saving' | 'success' | 'error';

interface FloatingSaveButtonProps {
  status: FloatingSaveStatus;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Botón flotante compacto "Guardar y quedarse" — mismo componente para
 * `ProductForm` (incluido embebido en el drawer de sets) y `SetForm`, para que
 * el comportamiento sea idéntico en los tres contextos. Solo ícono: fondo
 * semitransparente en reposo, azul + check al confirmar guardado (10s) y rojo +
 * X si falla (10s), controlado por el `status` que gestiona el formulario padre.
 */
export function FloatingSaveButton({ status, onClick, disabled }: FloatingSaveButtonProps) {
  const isSaving = status === 'saving';
  const isSuccess = status === 'success';
  const isError = status === 'error';

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled || isSaving}
      size="icon"
      title="Guardar y quedarse"
      aria-label="Guardar y quedarse"
      className={cn(
        'fixed z-40 right-4 md:right-8 h-11 w-11 rounded-full shadow-lg transition-colors',
        'bottom-[calc(9rem_+_env(safe-area-inset-bottom))] md:bottom-6',
        isSuccess && 'bg-blue-600 hover:bg-blue-600 text-white',
        isError && 'bg-red-600 hover:bg-red-600 text-white',
        !isSuccess && !isError && 'bg-[#111111]/50 hover:bg-[#111111]/70 text-white'
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
