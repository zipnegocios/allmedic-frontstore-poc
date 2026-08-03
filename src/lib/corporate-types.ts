import type { ProductColor, ProductVariant } from './types';
import type { Gender } from './types';
import type { MediaItem } from './media';

export interface SetPiece {
  /** Id de la fila `set_block_options` (opción de bloque) o `set_recommended_items` según el
   * arreglo donde aparezca esta pieza — no hay más un `set_items.id` único. */
  setItemId: string;
  productId: string;
  productName: string;
  productSlug: string;
  /** Código de estilo del fabricante (`products.code`, ej. "WW625") — usado en "Combinaciones
   * armadas" del PDP para identificar la pieza sin repetir el nombre completo del producto. */
  productCode: string;
  /** Nombre del Tipo de Producto (EAV, ej. "Camisa", "Pantalón") — `null` si el producto no
   * tiene tipo asignado. Mismo uso que `productCode` en "Combinaciones armadas". */
  productTypeName: string | null;
  /** Presente solo en piezas que son opción de un bloque (ausente en `recommendedPieces`,
   * que no tienen cantidad propia — la cantidad la define el cliente en la PDP). */
  quantityPerSet?: number;
  priceWholesale: number | null;
  priceWholesaleSale: number | null;
  colors: ProductColor[];
  availableSizes: string[];
  /** Agregado EAV de `variants[].styles` de esta pieza (slug de atributo → valores únicos
   * presentes) — mismo patrón que `Product.availableStyles` en retail. Vacío `{}` si la
   * pieza no tiene ningún atributo en modo VARIANT. */
  availableStyles: Record<string, string[]>;
  /** Nombre legible de cada atributo en `availableStyles` (slug → nombre) — evita mostrar
   * el slug crudo en el selector de la PDP corporativa. */
  styleLabels: Record<string, string>;
  variants: ProductVariant[];
}

/** Un bloque de alternancia — el cliente elige 1 de las `options` (1 o 2: si el bloque tiene
 * una sola prenda configurada no hay alternativa que elegir). `quantityPerSet` es único por
 * bloque (compartido entre sus opciones), no por pieza individual. */
export interface SetBlock {
  id: string;
  blockCode: 'A' | 'B';
  quantityPerSet: number;
  options: SetPiece[];
}

export interface CorporateSetSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** Portada primaria/secundaria "efectivas" — derivadas del color por defecto (primer
   * `sortOrder` de `coversByColor`), usadas donde no importa el color activo (ej. ítem de
   * carrito, mega-menu). `secondaryCover` ausente si no hay hover-swap. */
  cover: MediaItem | null;
  secondaryCover: MediaItem | null;
  /** Portadas por color (Set × Color) — una entrada por color con portada primaria cargada,
   * ordenadas por `sortOrder` (posición 0 = color por defecto del set). Fuente de verdad para
   * el hover-swap dinámico por color en `/corporativo` (ver `resolveCardCover`). */
  coversByColor: Array<{
    colorId: string;
    colorCode: string;
    sortOrder: number;
    cover: MediaItem;
    secondaryCover: MediaItem | null;
  }>;
  brandName: string | null;
  /** Id de la marca (para resolver reglas por ítem en el grid — `brandName` es solo para mostrar/filtrar). */
  brandId: string | null;
  /** URL del logo de marca (media_links role LOGO) — null si la marca no tiene logo cargado. */
  brandLogoUrl: string | null;
  /** Ids de los productos que componen el set — para resolver reglas de ámbito Producto en el grid. */
  productIds: string[];
  isFeatured: boolean;
  /** Número de bloques del set — siempre 2 (Bloque A / Bloque B), nunca la cantidad de
   * opciones cargadas (cada bloque tiene 1 o 2 piezas configurables). */
  pieceCount: number;
  /** true si el set tiene al menos una pieza recomendada activa — usado por el grid para
   * mostrar el badge correspondiente sin traer `recommendedPieces` completo. */
  hasRecommendedItems: boolean;
  referencePrice: number | null;
  hasMissingPrices: boolean;
  /** Atributos agregados de las piezas activas del set — usados por el filtrado de `/corporativo`.
   * Unión amplia (cualquier color presente en cualquier pieza), a propósito: un set en modo MIXED
   * con "Wine" en una sola pieza debe seguir siendo encontrado por el filtro de color "Wine". */
  colors: ProductColor[];
  /** Colores realmente comprables en el listado — en modo PAIRED, intersección de color entre
   * al menos una opción de Bloque A y una de Bloque B (mismo criterio que `strictPairedColors`
   * en la PDP); en modo MIXED, colores presentes en `colorCombos` curados por el admin. Fuente de
   * verdad para el swatch de la card del listado — NO usar `colors` ahí (ver `SetGridCard`). */
  pairedColors: ProductColor[];
  sizes: string[];
  genders: Gender[];
  /** Nombres de `productTypes` (EAV) presentes entre las piezas del set — fuente de verdad para filtros. Vacío si ninguna pieza tiene `productTypeId` asignado. */
  productTypes: string[];
  /** Colecciones presentes entre las piezas activas del set — unión, no intersección (una pieza
   * de cualquier colección basta para que el set matchee ese filtro). `logoUrl` viene de
   * `media_links` (entityType COLLECTION, role LOGO) — null si la colección no tiene imagen
   * cargada en el admin, mismo patrón que `brandLogoUrl`. */
  collections: { id: string; name: string; logoUrl: string | null }[];
  /** Agregado EAV de `variants[].styles` a través de todas las piezas del set: slug de atributo → valores únicos presentes. */
  availableStyles: Record<string, string[]>;
  /** Nombre legible de cada slug presente en `availableStyles` (ej. `corte-tops` → `Modelo de
   * Corte`) — mismo patrón que `SetPiece.styleLabels` en la PDP, ahora también a nivel de set
   * agregado para el filtro de `/corporativo`. Fallback al slug capitalizado si el atributo no
   * tiene `name` (dato inconsistente). */
  styleLabels: Record<string, string>;
  pieceNames: string[];
  /** Código de estilo del fabricante (`products.code`, ej. "2624A") de cada pieza activa del
   * set — fuente de verdad para buscar sets por código de producto (`buildSetSearchWords`). */
  pieceCodes: string[];
  createdAt: string;
}

/** Una combinación de color curada por el admin (modo MIXED) — una entrada por pieza del set. */
export interface SetColorCombo {
  id: string;
  items: Array<{ productId: string; colorCode: string }>;
}

/** Item liviano de set para navegación (mega-menu, uso con `getLatestCorporateSets`) y para el
 * autocompletado del Header (uso con `getSearchableCorporateSets`) — este segundo caso agrega
 * los campos mínimos necesarios para buscar por color/colección/tipo/atributo/código, y para
 * mostrar la portada del color buscado en el dropdown (`resolveCardCover` en `Header.tsx`), sin
 * llegar al peso completo de `CorporateSetSummary` (sin variantes, sin precios por bloque). */
export interface CorporateSetNavItem {
  id: string;
  slug: string;
  name: string;
  cover: MediaItem | null;
  /** Portada secundaria (hover-swap) del color por defecto — no se usa en el dropdown del
   * Header (sin hover), presente solo por paridad de forma con `resolveCardCover`. */
  secondaryCover: MediaItem | null;
  brandName: string | null;
  referencePrice: number | null;
  /** Vacío cuando el item viene de `getLatestCorporateSets` (mega-menu, no necesita buscar). */
  colors: ProductColor[];
  /** Colores realmente comprables — usados por `findSearchMatchedColorId` con prioridad sobre
   * `colors` (mismo criterio que `CorporateSetSummary.pairedColors`). Vacío en `getLatestCorporateSets`. */
  pairedColors: ProductColor[];
  /** Portadas por color — permite mostrar en el dropdown la imagen del color que matcheó la
   * búsqueda (`resolveCardCover`). Vacío en `getLatestCorporateSets`. */
  coversByColor: CorporateSetSummary['coversByColor'];
  collections: string[];
  productTypes: string[];
  availableStyles: Record<string, string[]>;
  /** Código de estilo del fabricante de cada pieza — ver `CorporateSetSummary.pieceCodes`. */
  pieceCodes: string[];
}

export interface CorporateSetDetail extends CorporateSetSummary {
  brandId: string | null;
  /** Tupla fija de 2 — Bloque A y Bloque B, siempre en ese orden. */
  blocks: [SetBlock, SetBlock];
  /** Piezas sugeridas de la misma colección/marca — libres, no forman parte de los bloques,
   * no afectan `MIN_QUANTITY`/`COLOR_RESTRICTION`/`COLOR_PAIRING` del set. */
  recommendedPieces: SetPiece[];
  /** PAIRED = la pieza elegida de cada bloque se pide en un único color compartido; MIXED = el
   * comprador solo puede elegir entre `colorCombos` (combinaciones de color curadas por el
   * admin, una entrada por productId de opción de bloque). */
  colorMode: 'PAIRED' | 'MIXED';
  /** Solo poblado (y relevante) cuando `colorMode === 'MIXED'` — combos activos, ya ordenados. */
  colorCombos: SetColorCombo[];
}
