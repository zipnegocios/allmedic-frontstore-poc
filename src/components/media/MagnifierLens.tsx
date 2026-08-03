export const LENS_DIAMETER_PX = 200;

export interface MagnifierLensProps {
  /** Centro deseado del círculo, en px relativos a la esquina superior-izq. del contenedor
   * padre (position: relative) — ya clampeado para que el círculo no se salga del rect. */
  centerX: number;
  centerY: number;
  /** Punto (0-1) sobre el que se centra el contenido ampliado — sin clampear, para que el
   * contenido siga el cursor/dedo exacto aunque el círculo visual quede clampeado cerca del borde. */
  originX: number;
  originY: number;
  zoomLevel: number;
  lensUrl: string;
  diameter?: number;
  /** Tamaño (en px CSS) al que se ve la imagen dentro del visor principal — el mismo rect
   * `object-contain` calculado por el padre, en su proporción natural (ancho/alto reales, NO
   * forzados al cuadrado de la lente). Es la base "1x" que se multiplica por `zoomLevel` para
   * el `backgroundSize`: al usar píxeles en vez de porcentaje (que es relativo al cuadrado de
   * la lente), la imagen ampliada mantiene su proporción real y no se deforma en los bordes. */
  sourceWidth: number;
  sourceHeight: number;
}

/** Círculo de presentación puro: no sabe de hover/touch/hooks, solo pinta la lente ya
 * posicionada. Reusable en cualquier lugar que ya tenga las coordenadas resueltas. */
export function MagnifierLens({
  centerX,
  centerY,
  originX,
  originY,
  zoomLevel,
  lensUrl,
  diameter = LENS_DIAMETER_PX,
  sourceWidth,
  sourceHeight,
}: MagnifierLensProps) {
  return (
    <div
      className="absolute rounded-full overflow-hidden border border-white/60 shadow-lg pointer-events-none z-30"
      style={{
        width: diameter,
        height: diameter,
        left: centerX - diameter / 2,
        top: centerY - diameter / 2,
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${lensUrl})`,
          // Píxeles con la proporción natural de la imagen (no % del cuadrado de la lente) —
          // evita estirar de forma no uniforme una foto que no es cuadrada.
          backgroundSize: `${sourceWidth * zoomLevel}px ${sourceHeight * zoomLevel}px`,
          backgroundPosition: `${originX * 100}% ${originY * 100}%`,
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  );
}
