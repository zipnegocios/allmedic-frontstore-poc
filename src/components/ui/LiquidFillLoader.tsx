import { cn } from '@/lib/utils';

interface LiquidFillLoaderProps {
  /** Ancho/alto de la barra — por defecto ocupa el 100% del contenedor padre
   * (pensado para superponerse sobre una card/imagen), pero puede fijarse a un
   * tamaño puntual pasando clases de ancho/alto propias. */
  className?: string;
  /** Texto anunciado a lectores de pantalla mientras la barra está visible. */
  label?: string;
}

/**
 * Barra de progreso indeterminada con efecto de onda líquida — usada como indicador de carga
 * mientras se descarga la imagen de un color recién seleccionado (filtro de color en listados
 * de producto y PDP corporativo). Recoloreada a blanco/negro puro (marca AllMedic): la onda es
 * negro sólido con textura de rayas diagonales blancas semitransparentes, el track es un gris
 * casi transparente y el "glass" (brillo superior + sombra inferior) se mantiene neutral.
 */
export function LiquidFillLoader({ className, label = 'Cargando imagen' }: LiquidFillLoaderProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        'relative w-full h-3.5 min-h-[10px] max-w-[140px] rounded-full overflow-hidden',
        'bg-black/5 border border-black/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]',
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-0 -left-[140%] w-[140%] rounded-r-full',
          'bg-[repeating-linear-gradient(60deg,rgba(255,255,255,0.35)_0_4px,transparent_4px_12px)] bg-[#111111]',
          'bg-blend-overlay',
          'motion-safe:animate-liquid-flow motion-reduce:left-0'
        )}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full pointer-events-none bg-gradient-to-b from-white/25 via-transparent to-black/20"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
