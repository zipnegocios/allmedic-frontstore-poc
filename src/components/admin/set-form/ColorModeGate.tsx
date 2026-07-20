'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type ColorMode = 'PAIRED' | 'MIXED';

interface ColorModeGateProps {
  value: ColorMode | undefined;
  onChange: (mode: ColorMode) => void;
  /** El sistema obliga a definir el nombre del set antes de elegir la modalidad. */
  nameFilled: boolean;
}

/** Camisa + pantalón en línea, sin librería externa — silueta simple reutilizada por ambas cards. */
function GarmentPairIcon({ colorA, colorB }: { colorA: string; colorB: string }) {
  return (
    <svg viewBox="0 0 64 40" className="w-14 h-9" aria-hidden="true">
      {/* Camisa */}
      <path
        d="M8 4 L16 4 L20 8 L24 4 L32 4 L32 10 L28 12 L28 30 L8 30 L8 12 L4 10 Z"
        fill={colorA}
        stroke="rgba(0,0,0,0.15)"
        strokeWidth="0.5"
      />
      {/* Pantalón */}
      <path
        d="M36 4 L58 4 L58 16 L52 16 L50 34 L44 34 L43 18 L41 34 L35 34 L36 16 Z"
        fill={colorB}
        stroke="rgba(0,0,0,0.15)"
        strokeWidth="0.5"
      />
    </svg>
  );
}

const PAIRED_PAIRS = [
  ['#DC2626', '#DC2626'],
  ['#16A34A', '#16A34A'],
  ['#2563EB', '#2563EB'],
  ['#CA8A04', '#CA8A04'],
];

const MIXED_PAIRS = [
  ['#DC2626', '#16A34A'],
  ['#16A34A', '#2563EB'],
  ['#CA8A04', '#2563EB'],
  ['#CA8A04', '#DC2626'],
];

function ModeCard({
  title,
  description,
  pairs,
  selected,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  pairs: string[][];
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'text-left rounded-lg border-2 p-4 transition-colors',
        selected ? 'border-[#111111] bg-gray-50' : 'border-gray-200 hover:border-gray-300',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <p className="font-semibold mb-1">{title}</p>
      <p className="text-xs text-gray-500 mb-3">{description}</p>
      <div className="grid grid-cols-2 gap-2">
        {pairs.map(([a, b], i) => (
          <GarmentPairIcon key={i} colorA={a} colorB={b} />
        ))}
      </div>
    </button>
  );
}

export function ColorModeGate({ value, onChange, nameFilled }: ColorModeGateProps) {
  if (value) {
    const label = value === 'PAIRED' ? 'Piezas combinadas por color' : 'Piezas mezcladas por color';
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm text-gray-500">Modo de color del set</p>
              <p className="font-semibold">{label}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onChange('PAIRED')}
                className={cn(
                  'text-sm px-3 py-1.5 rounded-md border',
                  value === 'PAIRED' ? 'border-[#111111] bg-gray-50 font-medium' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                )}
              >
                Combinadas
              </button>
              <button
                type="button"
                onClick={() => onChange('MIXED')}
                className={cn(
                  'text-sm px-3 py-1.5 rounded-md border',
                  value === 'MIXED' ? 'border-[#111111] bg-gray-50 font-medium' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                )}
              >
                Mezcladas
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <h3 className="font-semibold">¿Qué tipo de set quieres crear?</h3>
          {!nameFilled && (
            <p className="text-xs text-amber-600 mt-1">Completa el nombre del set (paso &quot;Datos generales&quot;) para elegir la modalidad.</p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModeCard
            title="Piezas del Set combinadas por color"
            description="Todas las piezas del set se piden siempre en el mismo color — el comprador elige un solo color para todo el set."
            pairs={PAIRED_PAIRS}
            selected={false}
            disabled={!nameFilled}
            onClick={() => onChange('PAIRED')}
          />
          <ModeCard
            title="Piezas del Set mezcladas por color"
            description="Tú defines combinaciones específicas de color por pieza — el comprador elige entre esas combinaciones curadas."
            pairs={MIXED_PAIRS}
            selected={false}
            disabled={!nameFilled}
            onClick={() => onChange('MIXED')}
          />
        </div>
      </CardContent>
    </Card>
  );
}
