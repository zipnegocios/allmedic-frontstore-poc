import type {
  MinQuantityConfig,
  SizeModeConfig,
  PriceVisibilityConfig,
} from "./types";

// ─── Defaults del sistema (sección 1 del plan de negocio) ───
// Se aplican cuando no existe ninguna regla activa para un tipo dado.

export const DEFAULT_MIN_QUANTITY: MinQuantityConfig = {
  min: 12,
  countUnit: "SETS",
};

export const DEFAULT_SIZE_MODE: SizeModeConfig = {
  mode: "MATRIX",
};

export const DEFAULT_PRICE_VISIBILITY: PriceVisibilityConfig = {
  showPrices: true,
  catalog: "BOTH",
};
