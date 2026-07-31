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
}

/** Círculo de presentación puro: no sabe de hover/touch/hooks, solo pinta la lente ya
 * posicionada. Reusable en cualquier lugar que ya tenga las coordenadas resueltas. */
export function MagnifierLens({ centerX, centerY, originX, originY, zoomLevel, lensUrl, diameter = LENS_DIAMETER_PX }: MagnifierLensProps) {
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
          backgroundSize: `${zoomLevel * 100}% ${zoomLevel * 100}%`,
          backgroundPosition: `${originX * 100}% ${originY * 100}%`,
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  );
}
