// ─── Documentación embebida del Motor de Reglas ───
// Fuente única de verdad para el panel admin (RuleDocPanel), tooltips y cualquier
// ayuda futura (incluido RAG). Módulo puro — sin dependencias de DB ni Next.js.
//
// `appliesTo` y `supportedScopes` reflejan el comportamiento real y verificado del sistema
// (ver `docs/audits/AUDITORIA-motor-reglas.md`), no la aspiración del diseño original. Cualquier
// cambio de comportamiento se documenta aquí en el mismo cambio de código — nunca por separado.

import type { RuleType, RuleScope } from "./types";

export interface RuleFieldDoc {
  key: string;
  label: string;
  description: string;
  options?: { value: string; label: string; description: string }[];
  example?: string;
}

export interface RuleTypeDoc {
  ruleType: RuleType;
  title: string;
  summary: string;
  detail: string;
  appliesTo: ("INDIVIDUAL" | "CORPORATE")[];
  supportedScopes: RuleScope[];
  defaultBehavior: string;
  fields: RuleFieldDoc[];
  examples: { title: string; config: Record<string, unknown>; explanation: string }[];
  interactions: string[];
  warnings: string[];
}

// ─── Bloque común de jerarquía y resolución ───
export const HIERARCHY_DOC = {
  title: "Cómo se resuelven las reglas",
  detail:
    "Para cada tipo de regla, el motor busca la regla activa más específica siguiendo el orden " +
    "Producto > Set > Grupo de Sets > Marca > Global. La primera que encuentra una regla activa " +
    "en ese orden es la que aplica — las reglas más generales de niveles inferiores se ignoran " +
    "para ese contexto. Una regla de ámbito Producto aplica a cualquier set que incluya ese " +
    "producto entre sus piezas (catálogo corporativo) o a la ficha de ese producto (catálogo " +
    "individual); si un set tiene dos piezas con reglas Producto distintas del mismo tipo, " +
    "gana la de mayor Prioridad entre ambas, igual que cualquier otro empate de ámbito. Si dos " +
    "reglas activas compiten en el mismo ámbito (mismo tipo, mismo ámbito, mismo elemento), gana " +
    "la de mayor Prioridad. Si no existe ninguna regla activa para un tipo dado, se usan los " +
    "valores por defecto del sistema.",
  validityWindows:
    "Los campos 'Vigente desde' y 'Vigente hasta' son opcionales. Una regla con vigencia futura " +
    "o ya vencida se trata como inactiva para ese momento, aunque el interruptor 'Activa' esté encendido.",
  multiInstance:
    "Los tipos Promoción y Restricción por color son distintos al resto: en vez de que la regla " +
    "más específica reemplace a las demás, TODAS las reglas activas y aplicables de ese tipo se " +
    "acumulan (por ejemplo, puedes tener dos promociones distintas vigentes al mismo tiempo sobre " +
    "el mismo set).",
  conflictDetection:
    "Al crear o editar una regla, el sistema verifica automáticamente si entra en conflicto con " +
    "otras reglas existentes (duplicados en el mismo ámbito, mínimos que contradicen rangos o " +
    "múltiplos, promociones inalcanzables, descuentos sobre precios ocultos, etc.). Los conflictos " +
    "graves (rojo) impiden guardar; las advertencias (ámbar) requieren tu confirmación explícita; " +
    "los avisos informativos (azul) no bloquean nada. El servidor vuelve a verificar los conflictos " +
    "graves al guardar, aunque el formulario ya los haya mostrado — nunca se puede saltar esa " +
    "verificación desde el navegador.",
} as const;

export const RULE_DOCS: Record<RuleType, RuleTypeDoc> = {
  MIN_QUANTITY: {
    ruleType: "MIN_QUANTITY",
    title: "Cantidad mínima",
    summary: "Define cuántos sets como mínimo debe tener el carrito (o un subconjunto de él) para poder enviar la solicitud de cotización.",
    detail:
      "El ámbito Global exige un mínimo sobre el carrito completo — mientras el total sea menor, el " +
      "cliente ve un mensaje como 'Agrega 4 sets más para alcanzar el mínimo de 12' y el botón de " +
      "envío permanece deshabilitado. Los ámbitos Marca, Grupo de Sets, Set y Producto exigen, " +
      "ADEMÁS, su propio mínimo sobre el subconjunto de sets que caen bajo ese ámbito — por ejemplo, " +
      "una regla de ámbito Marca con mínimo 24 exige que los sets de esa marca en el carrito sumen " +
      "al menos 24, sin importar cuántos otros sets de otras marcas haya. El mínimo Global y los " +
      "mínimos contextuales se exigen A LA VEZ: uno no reemplaza al otro. Cada set del carrito cae, " +
      "como máximo, bajo un mínimo contextual (el más específico según la jerarquía Producto > Set > " +
      "Grupo de Sets > Marca); si no hay ninguna regla contextual que lo cubra, solo se le exige el " +
      "mínimo Global.",
    appliesTo: ["CORPORATE"],
    supportedScopes: ["GLOBAL", "BRAND", "SET_GROUP", "SET", "PRODUCT"],
    defaultBehavior: "Sin ninguna regla activa, el mínimo Global es 12 sets (unidad Sets) para el carrito completo, sin mínimos contextuales adicionales.",
    fields: [
      {
        key: "min",
        label: "Cantidad mínima",
        description: "Número mínimo de unidades (en la unidad elegida abajo) que debe alcanzar el carrito para poder enviarse.",
        example: "12",
      },
      {
        key: "countUnit",
        label: "Unidad de conteo",
        description: "En qué unidad se mide el mínimo.",
        options: [
          { value: "SETS", label: "Sets", description: "Cuenta la cantidad total de sets del carrito (suma de todas las líneas de todos los sets)." },
          { value: "PIECES", label: "Piezas", description: "Cuenta piezas individuales reales: cada set del carrito aporta tantas piezas como suman sus componentes (ej. un set de camisa + pantalón aporta 2 piezas por unidad)." },
        ],
      },
    ],
    examples: [
      { title: "Mínimo global estándar", config: { min: 12, countUnit: "SETS" }, explanation: "El comportamiento por defecto del sistema — mínimo de 12 sets en todo el carrito." },
      { title: "Mínimo adicional por marca", config: { min: 24, countUnit: "SETS" }, explanation: "Aplicada en ámbito Marca: exige 24 sets de esa marca específica, además del mínimo Global del carrito completo." },
      { title: "Mínimo en piezas", config: { min: 100, countUnit: "PIECES" }, explanation: "Exige 100 piezas reales en el ámbito de la regla, sin importar cuántos sets distintos las componen." },
    ],
    interactions: [
      "Si además existe una regla de Rango de cantidad (QUANTITY_RANGE) con un máximo menor a este mínimo en el mismo ámbito, ninguna cantidad satisface ambas reglas a la vez — el detector de conflictos marca esto como error.",
    ],
    warnings: [
      "La ficha del set muestra un solo número: el mínimo de la regla más específica que le aplica (o el Global si no hay ninguna más específica). Si además existe un mínimo Global distinto, ese mínimo del carrito completo se exige igual y se comunica por separado en el carrito — la ficha no combina ambos números en un solo mensaje.",
    ],
  },

  MULTIPLES_ONLY: {
    ruleType: "MULTIPLES_ONLY",
    title: "Solo múltiplos",
    summary: "Exige que la cantidad de cada línea del carrito sea un múltiplo exacto de un número (por ejemplo, solo docenas).",
    detail:
      "Se valida línea por línea dentro de cada set del carrito corporativo. Si la cantidad ingresada " +
      "no es múltiplo exacto del valor configurado, se muestra un mensaje como 'La cantidad para " +
      "\"Uniforme FIGS Premium\" debe ser múltiplo de 6' y el envío queda bloqueado hasta corregirla.",
    appliesTo: ["CORPORATE"],
    supportedScopes: ["GLOBAL", "BRAND", "SET_GROUP", "SET", "PRODUCT"],
    defaultBehavior: "Sin ninguna regla activa, no se exige ningún múltiplo — cualquier cantidad positiva es válida.",
    fields: [
      {
        key: "multipleOf",
        label: "Múltiplo exacto",
        description: "La cantidad de cada línea debe ser divisible exactamente entre este número.",
        example: "6",
      },
    ],
    examples: [
      { title: "Solo docenas", config: { multipleOf: 12 }, explanation: "Cada línea debe pedirse en múltiplos de 12 (12, 24, 36…)." },
      { title: "Grupos de 6", config: { multipleOf: 6 }, explanation: "Útil para sets que se empacan de 6 en 6." },
    ],
    interactions: [
      "Si el mínimo de cantidad (Rango de cantidad o Cantidad mínima) no es en sí mismo múltiplo de este valor, el mínimo real que percibe el cliente es el siguiente múltiplo hacia arriba — el detector de conflictos lo advierte.",
    ],
    warnings: [],
  },

  QUANTITY_RANGE: {
    ruleType: "QUANTITY_RANGE",
    title: "Rango de cantidad",
    summary: "Limita cada línea del carrito a un rango de cantidades permitidas (mínimo y, opcionalmente, máximo).",
    detail:
      "A diferencia de Cantidad mínima (que mira el total del carrito), este rango se valida por " +
      "línea individual dentro de cada set. Un máximo vacío significa 'sin límite superior'.",
    appliesTo: ["CORPORATE"],
    supportedScopes: ["GLOBAL", "BRAND", "SET_GROUP", "SET", "PRODUCT"],
    defaultBehavior: "Sin ninguna regla activa, no se aplica ningún rango por línea (solo aplican otras reglas como Cantidad mínima o Solo múltiplos, si existen).",
    fields: [
      { key: "min", label: "Mínimo", description: "Cantidad mínima permitida en la línea.", example: "12" },
      { key: "max", label: "Máximo", description: "Cantidad máxima permitida en la línea. Déjalo vacío para no poner límite superior.", example: "50" },
    ],
    examples: [
      { title: "Rango cerrado", config: { min: 12, max: 100 }, explanation: "Entre 12 y 100 unidades por línea." },
      { title: "Rango abierto", config: { min: 12, max: null }, explanation: "12 en adelante, sin tope." },
    ],
    interactions: [
      "Si el máximo de este rango es menor que el mínimo de Cantidad mínima aplicable al mismo contexto, ninguna cantidad satisface ambas reglas — el detector de conflictos lo marca como error.",
      "Si no existe ningún múltiplo de 'Solo múltiplos' dentro de este rango, el rango es inalcanzable — el detector de conflictos lo marca como error.",
    ],
    warnings: [],
  },

  SIZE_MODE: {
    ruleType: "SIZE_MODE",
    title: "Modo de tallas",
    summary: "Define el comportamiento del armador de combinaciones al elegir talla de cada pieza en el catálogo corporativo.",
    detail:
      "El armador de combinaciones es el único flujo de compra corporativo: el cliente elige color y " +
      "talla de CADA pieza del set por separado y arma una o varias combinaciones antes de llevarlas " +
      "al carrito. Este tipo de regla no cambia esa estructura — cambia su comportamiento. En Matriz, " +
      "el armador muestra además un atajo ('todo el set en la misma talla') que rellena de un tap la " +
      "talla de todas las piezas, editable pieza por pieza después. En Talla independiente por pieza, " +
      "el armador no ofrece atajo — cada pieza se elige por separado desde el inicio. En Sin tallas, " +
      "el armador oculta el selector de talla en cada pieza; solo quedan color (si aplica) y cantidad.",
    appliesTo: ["CORPORATE"],
    supportedScopes: ["GLOBAL", "BRAND", "SET_GROUP", "SET", "PRODUCT"],
    defaultBehavior: "Sin ninguna regla activa, se usa el modo Matriz de tallas.",
    fields: [
      {
        key: "mode",
        label: "Modo",
        description: "Comportamiento del armador de combinaciones frente a la talla de cada pieza.",
        options: [
          { value: "MATRIX", label: "Matriz de tallas", description: "El armador ofrece el atajo 'todo el set en la misma talla' además de la edición pieza por pieza." },
          { value: "PER_PIECE", label: "Talla independiente por pieza", description: "El cliente elige la talla de cada pieza del set por separado desde el inicio, sin atajo (ej. camisa en M, pantalón en L)." },
          { value: "NO_SIZES", label: "Sin tallas", description: "El armador oculta el selector de talla — el set no maneja tallas, solo color (si aplica) y cantidad de sets." },
        ],
      },
    ],
    examples: [
      { title: "Matriz estándar", config: { mode: "MATRIX" }, explanation: "El comportamiento por defecto — atajo de talla única disponible, editable por pieza." },
      { title: "Sin tallas", config: { mode: "NO_SIZES" }, explanation: "Para sets que no varían por talla (ej. accesorios)." },
    ],
    interactions: [],
    warnings: [
      "El modo de tallas es una propiedad de TODO el set, no de una pieza individual — una regla de ámbito Producto determina el modo del set completo cuando gana la resolución (por ser la más específica o por prioridad frente a otra regla Producto del mismo set), no solo el de esa pieza.",
    ],
  },

  PRICE_VISIBILITY: {
    ruleType: "PRICE_VISIBILITY",
    title: "Visibilidad de precios",
    summary: "Muestra u oculta los precios en el catálogo individual y/o corporativo, por ítem: cada tarjeta o ficha resuelve su propia visibilidad según su marca/producto/set.",
    detail:
      "Se resuelve POR ÍTEM en cada punto donde se muestra un precio: tarjetas de producto, ficha de " +
      "detalle, menú, buscador y carrito (catálogo individual); grid y ficha de detalle de sets " +
      "(catálogo corporativo). Una regla de ámbito Marca oculta el precio en todas las tarjetas y " +
      "fichas de esa marca a la vez — listado y detalle siempre muestran lo mismo para un mismo " +
      "producto o set, sin importar en qué punto del sitio se consulte.",
    appliesTo: ["INDIVIDUAL", "CORPORATE"],
    supportedScopes: ["GLOBAL", "BRAND", "SET_GROUP", "SET", "PRODUCT"],
    defaultBehavior: "Sin ninguna regla activa, se muestran los precios en ambos catálogos.",
    fields: [
      { key: "showPrices", label: "Mostrar precios", description: "Si está apagado, el precio no se renderiza en ningún lugar del catálogo indicado abajo." },
      {
        key: "catalog",
        label: "Catálogo",
        description: "En qué catálogo(s) aplica esta regla.",
        options: [
          { value: "INDIVIDUAL", label: "Individual", description: "Solo el catálogo de venta individual (/catalogo, ficha de producto, carrito)." },
          { value: "CORPORATE", label: "Corporativo", description: "Solo el catálogo de venta al mayor (/corporativo)." },
          { value: "BOTH", label: "Ambos", description: "Los dos catálogos a la vez." },
        ],
      },
    ],
    examples: [
      { title: "Ocultar precios en todo el sitio", config: { showPrices: false, catalog: "BOTH" }, explanation: "Modo 'solo cotización' — ningún catálogo muestra precio, el cliente contacta a ventas." },
      { title: "Ocultar solo en corporativo", config: { showPrices: false, catalog: "CORPORATE" }, explanation: "El catálogo individual sigue mostrando precio normalmente; solo el corporativo pasa a referencial sin cifra." },
      { title: "Ocultar precio de una marca específica", config: { showPrices: false, catalog: "INDIVIDUAL" }, explanation: "Aplicada en ámbito Marca: solo esa marca pasa a 'consultar precio' en tarjetas, ficha, buscador y carrito — el resto del catálogo individual sigue mostrando precio normalmente." },
    ],
    interactions: [
      "Si existen reglas de descuento (Escala por volumen, Promoción, Descuento por volumen individual) activas en un contexto donde esta regla oculta el precio, el cliente nunca ve el beneficio del descuento — el detector de conflictos lo advierte.",
    ],
    warnings: [
      "El resumen agregado del carrito individual (subtotal/total del drawer) y los componentes de navegación (menú, mega-menú) evalúan solo el ámbito Global — no representan un único producto o marca, así que una regla de ámbito Marca/Set/Producto no los afecta directamente (sí afecta cada línea del carrito individualmente).",
    ],
  },

  INVENTORY_MODE: {
    ruleType: "INVENTORY_MODE",
    title: "Modo de inventario",
    summary: "Define si el carrito corporativo debe bloquear, avisar o ignorar cuando la cantidad pedida excede el stock real de una talla/producto.",
    detail:
      "Se resuelve por set (mismo patrón que Promoción o Solo múltiplos). La demanda se agrega por " +
      "producto, talla y color exactos: si dos combinaciones del carrito piden la misma talla y color " +
      "del mismo producto, sus cantidades se suman antes de comparar contra el stock disponible de esa " +
      "combinación exacta — solo participan en esa suma los sets cuyo modo efectivo no sea 'Ignorar'. " +
      "El stock se calcula sumando las variantes activas (status disponible) del producto agrupadas por " +
      "talla y color; cuando el set no maneja tallas (Modo de tallas: Sin tallas), se compara contra el " +
      "stock total del producto sin distinguir talla ni color. Con 'Bloquear', el envío de la solicitud " +
      "se rechaza (400) indicando qué producto/talla excede el stock y por cuánto. Con 'Solo " +
      "informativo', la solicitud se envía igual, pero el aviso queda registrado en las notas internas " +
      "de la cotización para el equipo de ventas y se muestra como advertencia en el carrito antes de " +
      "enviar.",
    appliesTo: ["CORPORATE"],
    supportedScopes: ["GLOBAL", "BRAND", "SET_GROUP", "SET"],
    defaultBehavior: "Sin ninguna regla activa, el modo es 'Ignorar stock' — coherente con el modelo de cotización referencial del negocio.",
    fields: [
      {
        key: "mode",
        label: "Modo",
        description: "Comportamiento frente al stock disponible.",
        options: [
          { value: "IGNORE", label: "Ignorar stock", description: "El carrito corporativo no considera el inventario para este contexto — el cliente puede pedir cualquier cantidad." },
          { value: "BLOCK", label: "Bloquear si no hay stock", description: "Impide enviar la solicitud si la demanda de algún producto/talla excede el stock disponible; muestra el motivo exacto." },
          { value: "INFORMATIVE", label: "Solo informativo", description: "Permite enviar la solicitud igual, pero muestra una advertencia no bloqueante y la registra en notas internas para ventas." },
        ],
      },
    ],
    examples: [
      { title: "Bloquear por marca", config: { mode: "BLOCK" }, explanation: "Útil en una Marca o Set con stock ajustado — impide sobrevender antes de que ventas confirme reposición." },
      { title: "Solo avisar", config: { mode: "INFORMATIVE" }, explanation: "Deja que el cliente envíe la solicitud igual (el modelo de negocio es de cotización referencial), pero alerta al equipo de ventas para que ajuste la cotización final." },
    ],
    interactions: [
      "Si Cantidad mínima (ámbito Global) exige más unidades de las que el stock real permite bajo 'Bloquear', ningún carrito puede enviarse — el detector de conflictos NO evalúa esto automáticamente porque no tiene acceso al stock en tiempo real (es un módulo puro, sin BD); revisa manualmente el stock disponible antes de combinar un mínimo alto con 'Bloquear'.",
    ],
    warnings: [
      "La disponibilidad agregada por talla y color que se muestra en el armador es una foto del momento de la carga de la página — no se recalcula mientras el cliente edita el carrito, así que puede quedar desactualizada si hay compras simultáneas.",
      "Cuando una pieza de la combinación no lleva color elegido, su demanda se suma contra el stock total de esa talla entre TODOS los colores — la comparación exacta por color solo aplica a piezas donde el cliente sí eligió color.",
      "El ámbito Producto no está disponible para este tipo: la demanda de stock se calcula por set completo (todas sus piezas a la vez), no por una pieza aislada, así que un modo de inventario distinto para un solo producto dentro de un set no tiene una semántica clara — usa el ámbito Set si necesitas ese nivel de control.",
    ],
  },

  VOLUME_SCALE: {
    ruleType: "VOLUME_SCALE",
    title: "Escala por volumen (corporativo)",
    summary: "Aplica un descuento porcentual sobre un subtotal del carrito corporativo (completo, o solo una marca/grupo/set/producto) según la cantidad de sets alcanzada.",
    detail:
      "Se resuelve POR SET: cada set del carrito cae bajo la escala más específica que le aplica " +
      "(Producto > Set > Grupo de Sets > Marca > Global). A diferencia de Promoción, las escalas NO " +
      "se acumulan entre sí — si un set calificaría para una escala Global y también para una de " +
      "Marca, solo se usa la de Marca (la más específica), nunca ambas juntas. El tramo elegido para " +
      "cada escala se calcula sobre la cantidad y el subtotal SOLO de los sets que caen bajo esa " +
      "escala en particular: una escala de ámbito Marca busca su tramo mirando solo cuántos sets de " +
      "esa marca hay en el carrito, y descuenta solo sobre el subtotal de esos sets.",
    appliesTo: ["CORPORATE"],
    supportedScopes: ["GLOBAL", "BRAND", "SET_GROUP", "SET", "PRODUCT"],
    defaultBehavior: "Sin ninguna regla activa, no se aplica ningún descuento por volumen en el catálogo corporativo.",
    fields: [
      {
        key: "tiers",
        label: "Tramos",
        description: "Lista de tramos { minQty: cantidad mínima de sets, discountPct: porcentaje de descuento }. Se aplica el tramo de mínimo más alto que alcanzan los sets cubiertos por esta regla.",
        example: "[{ minQty: 12, discountPct: 0 }, { minQty: 50, discountPct: 8 }]",
      },
    ],
    examples: [
      { title: "Dos tramos globales", config: { tiers: [{ minQty: 12, discountPct: 0 }, { minQty: 50, discountPct: 8 }] }, explanation: "Sobre el carrito completo: 0% hasta 49 sets, 8% desde 50 sets en adelante." },
      { title: "Escala propia para una marca", config: { tiers: [{ minQty: 5, discountPct: 20 }] }, explanation: "Aplicada en ámbito Marca: si esa marca sola alcanza 5+ sets en el carrito, descuenta 20% solo sobre el subtotal de esos sets — no se suma a ninguna escala Global que también exista." },
    ],
    interactions: [
      "Tramos con un 'mínimo de sets' por debajo del mínimo efectivo de Cantidad mínima nunca se alcanzan en la práctica (el carrito no puede enviarse antes de cumplir ese mínimo) — el detector de conflictos lo advierte.",
    ],
    warnings: [
      "Las escalas no se acumulan: si necesitas que una marca reciba SIEMPRE al menos el descuento Global más un extra, esta regla no lo modela directamente — la escala más específica reemplaza a la Global para esos sets, no la complementa.",
    ],
  },

  PROMO: {
    ruleType: "PROMO",
    title: "Promoción",
    summary: "8 tipos de promoción sobre el catálogo corporativo: por ítem, por umbral de carrito, informativas y cruzadas entre sets.",
    detail:
      "El campo 'kind' determina qué forma toma la promoción — cada tipo tiene sus propios campos de " +
      "configuración (ver abajo) y se calcula de forma distinta dentro de `computeCartPricing`. Los 5 " +
      "primeros tipos (N + 1, Porcentaje, Monto fijo, Precio fijo, N-ésima unidad) se resuelven POR SET " +
      "individual, igual que Solo múltiplos o Rango de cantidad — una promoción de ámbito Set solo " +
      "descuenta en ese set. 'Descuento por umbral' se evalúa sobre el subtotal agregado de todos los " +
      "sets dentro del ámbito de la regla (Global = todo el carrito; Marca/Grupo/Set = solo esos sets) y " +
      "se aplica UNA sola vez, no por cada set. 'Combo' cruza dos sets distintos y solo existe en ámbito " +
      "Global. 'Regalo' es puramente informativa: no cambia ningún precio, solo agrega un aviso. Si hay " +
      "varias promociones activas y aplicables al mismo contexto, se acumulan (multi-instancia), con un " +
      "tope: el descuento de cada set nunca supera su propio subtotal, y el total del carrito nunca queda " +
      "negativo. El resultado se muestra en el carrito como 'Descuento por promoción', con un desglose " +
      "por regla debajo cuando hay más de una aplicada a la vez.\n\n" +
      "Orden de aplicación dentro de `computeCartPricing`: (1) los 5 tipos por ítem, (2) Combo, " +
      "(3) Descuento por umbral, (4) Regalo (no toca montos). La Escala por volumen (VOLUME_SCALE) se " +
      "calcula antes que todo esto y no cambia.",
    appliesTo: ["CORPORATE"],
    supportedScopes: ["GLOBAL", "BRAND", "SET_GROUP", "SET", "PRODUCT"],
    defaultBehavior: "Sin ninguna regla activa, no se aplica ninguna promoción.",
    fields: [
      {
        key: "kind",
        label: "Tipo de promoción",
        description: "Determina la forma de la promoción y qué campos de configuración aplican.",
        options: [
          { value: "N_PLUS_ONE", label: "N + 1", description: "Por cada bloque completo de 'buy' unidades del set, 'free' unidades salen gratis." },
          { value: "PERCENT_OFF", label: "Porcentaje de descuento", description: "Descuenta 'pct'% del subtotal de la línea de ese set." },
          { value: "FIXED_AMOUNT_OFF", label: "Monto fijo por unidad", description: "Descuenta 'amountPerUnit' por cada unidad del set, topado al subtotal de la línea." },
          { value: "FIXED_PRICE", label: "Precio fijo promocional", description: "Fija el precio por set en 'price' — nunca encarece si 'price' es mayor o igual al precio normal." },
          { value: "NTH_UNIT_PCT", label: "Descuento en la N-ésima unidad", description: "Cada bloque completo de 'n' unidades incluye 1 unidad con 'pct'% de descuento (ej. 2da unidad al 50%)." },
          { value: "THRESHOLD_DISCOUNT", label: "Descuento por umbral de compra", description: "Si el subtotal del contexto de la regla alcanza 'minSubtotal', aplica 'pct'% o 'amount' fijo — una sola vez." },
          { value: "GIFT", label: "Regalo (informativo)", description: "Si se cumple 'minQty' y/o 'minSubtotal', agrega 'description' como aviso — no cambia ningún precio." },
          { value: "COMBO", label: "Combo entre dos sets", description: "Si el carrito tiene 'triggerMinQty' o más de 'triggerSetId', descuenta 'pct'% del subtotal de 'targetSetId'." },
        ],
      },
      { key: "buy", label: "Compra (N + 1)", description: "Cantidad que el cliente debe comprar del set para activar un ciclo de la promoción.", example: "13" },
      { key: "free", label: "Gratis (N + 1)", description: "Unidades adicionales gratuitas por cada bloque de 'buy' alcanzado.", example: "1" },
      { key: "pct", label: "Porcentaje", description: "Usado por Porcentaje de descuento, N-ésima unidad, Combo, y opcionalmente por Umbral.", example: "10" },
      { key: "amountPerUnit", label: "Monto fijo por unidad", description: "Descuento en dólares por cada unidad del set (Monto fijo por unidad).", example: "5" },
      { key: "price", label: "Precio promocional", description: "Precio por set de la promoción Precio fijo promocional.", example: "45" },
      { key: "n", label: "Cada N unidades", description: "Tamaño del bloque para N-ésima unidad (mínimo 2).", example: "2" },
      { key: "minSubtotal", label: "Subtotal mínimo", description: "Condición de subtotal para Umbral de compra y/o Regalo.", example: "500" },
      { key: "amount", label: "Monto fijo (umbral)", description: "Descuento en dólares de Umbral de compra, alternativo a 'pct' (exactamente uno de los dos).", example: "50" },
      { key: "minQty", label: "Cantidad mínima (regalo)", description: "Condición de cantidad de sets para Regalo — opcional, puede combinarse o sustituirse por 'minSubtotal'.", example: "12" },
      { key: "description", label: "Descripción del regalo", description: "Texto libre que ve el cliente y el equipo de ventas — obligatorio para Regalo.", example: "12 gorros quirúrgicos de cortesía" },
      { key: "triggerSetId", label: "Set disparador (combo)", description: "El set cuya cantidad en el carrito activa el combo." },
      { key: "triggerMinQty", label: "Cantidad mínima del disparador (combo)", description: "Unidades mínimas del set disparador para activar el combo.", example: "5" },
      { key: "targetSetId", label: "Set objetivo (combo)", description: "El set que recibe el descuento cuando el combo se activa." },
    ],
    examples: [
      { title: "13 + 1", config: { kind: "N_PLUS_ONE", buy: 13, free: 1 }, explanation: "Con 26 unidades del set a $10 c/u: 2 ciclos de 13 → 2 gratis → $20 de descuento." },
      { title: "20% de descuento", config: { kind: "PERCENT_OFF", pct: 20 }, explanation: "10 unidades a $10 c/u = subtotal $100 → 20% = $20 de descuento." },
      { title: "$3 menos por unidad", config: { kind: "FIXED_AMOUNT_OFF", amountPerUnit: 3 }, explanation: "10 unidades → $3 × 10 = $30 de descuento (nunca más que el subtotal de la línea)." },
      { title: "Precio fijo $45", config: { kind: "FIXED_PRICE", price: 45 }, explanation: "Si el precio normal es $50: 10 unidades × ($50 − $45) = $50 de descuento." },
      { title: "2da unidad al 50%", config: { kind: "NTH_UNIT_PCT", n: 2, pct: 50 }, explanation: "6 unidades a $10 c/u → 3 ciclos de 2 → 3 × $10 × 50% = $15 de descuento." },
      { title: "Umbral $500 → 10%", config: { kind: "THRESHOLD_DISCOUNT", minSubtotal: 500, pct: 10 }, explanation: "Si el subtotal del contexto llega a $600, aplica 10% = $60, una sola vez (no por set)." },
      { title: "Regalo por volumen", config: { kind: "GIFT", minQty: 12, description: "12 gorros quirúrgicos de cortesía" }, explanation: "Con 12+ sets en el contexto, aparece el aviso en el carrito y en notas internas de la cotización — no cambia el total." },
      { title: "Combo camisa + pantalón", config: { kind: "COMBO", triggerSetId: "<id-set-camisas>", triggerMinQty: 5, targetSetId: "<id-set-pantalones>", pct: 15 }, explanation: "Con 5+ unidades del set disparador en el carrito, el set objetivo recibe 15% de descuento sobre su propio subtotal." },
    ],
    interactions: [
      "N + 1: si el ámbito de esta promoción exige más unidades (buy) que el máximo permitido por Rango de cantidad en el mismo contexto, la promoción nunca se activa — el detector de conflictos lo advierte.",
      "Precio fijo promocional combinado con Porcentaje de descuento o Monto fijo por unidad en el mismo contexto acumula dos descuentos sobre el mismo set — el detector de conflictos lo advierte como una posible doble rebaja no intencional (no la bloquea, porque puede ser deliberada).",
      "Si Visibilidad de precios oculta el precio en el contexto donde una promoción con efecto monetario aplica, el cliente no ve el descuento reflejado — el detector de conflictos lo advierte. Regalo queda fuera de esta advertencia porque no tiene efecto monetario.",
      "Combo valida en el servidor (al guardar) que 'triggerSetId' y 'targetSetId' existan y estén activos — si alguno no existe o está inactivo, el guardado se bloquea con error. Esta verificación necesita base de datos, así que vive en la capa de rutas del panel admin, no en el detector de conflictos puro.",
    ],
    warnings: [
      "Regalo (GIFT) no tiene ningún efecto en el precio — es responsabilidad del equipo de ventas honrarlo manualmente al elaborar la cotización real. La nota queda registrada en el carrito, en la solicitud enviada y en las notas internas de la cotización.",
      "Descuento por umbral de compra no se puede combinar por diseño con Rango de cantidad para detectar 'umbral inalcanzable': el detector de conflictos es un módulo puro sin precios ni acceso a base de datos, así que no puede convertir un máximo de unidades en un subtotal en dólares. Revisa manualmente que el umbral configurado sea alcanzable dado el precio real de los sets del contexto.",
      "El desglose por regla ('promoBreakdown') no incluye Regalo — al no tener efecto monetario, solo aparece en los avisos ('promoNotes'), nunca en la lista de montos descontados.",
      "Combo es la excepción de ámbito: los otros 7 tipos aceptan Global/Marca/Grupo de Sets/Set/Producto, pero Combo solo se configura en Global (los dos sets involucrados ya van en su configuración, así que un ámbito adicional sería redundante).",
    ],
  },

  COLOR_RESTRICTION: {
    ruleType: "COLOR_RESTRICTION",
    title: "Restricción por color",
    summary: "Exige una cantidad mínima de una pieza cuando el cliente elige un color específico para ella, dentro de una combinación del armador.",
    detail:
      "El cliente elige color por CADA PIEZA del set en el armador de combinaciones (el color de una " +
      "camisa y el de un pantalón dentro del mismo set pueden ser distintos). El selector de color de " +
      "cada pieza solo ofrece los colores con al menos una variante activa de esa pieza — si una pieza " +
      "no tiene ningún color con stock activo, no se muestra selector para ella y la regla no tiene " +
      "forma de activarse sobre esa pieza. La restricción se evalúa por fila de combinación × pieza: " +
      "las unidades de una pieza en un color, dentro de una combinación, son " +
      "`cantidadDeSets × piezasPorSet` de esa pieza. Si ese total es menor al mínimo configurado para " +
      "el color, el envío se bloquea con un mensaje que nombra la pieza, el color y el mínimo exigido.",
    appliesTo: ["CORPORATE"],
    supportedScopes: ["GLOBAL", "BRAND", "SET_GROUP", "SET", "PRODUCT"],
    defaultBehavior: "Sin ninguna regla activa, elegir cualquier color no exige ninguna cantidad mínima adicional.",
    fields: [
      { key: "colorCode", label: "Color", description: "Color al que aplica la restricción, elegido de la tabla de colores real del catálogo.", example: "PINK" },
      { key: "min", label: "Mínimo requerido", description: "Cantidad mínima exigida de esa pieza en ese color, dentro de una combinación.", example: "6" },
    ],
    examples: [
      { title: "Mínimo por color especial", config: { colorCode: "PINK", min: 6 }, explanation: "Si el cliente elige el color rosado para una pieza, esa pieza debe sumar al menos 6 unidades dentro de la combinación (cantidad de sets × piezas por set)." },
    ],
    interactions: [],
    warnings: [
      "En el modo Sin tallas, el color de cada pieza sigue eligiéndose de forma independiente — la restricción se evalúa igual, solo que sin talla asociada.",
    ],
  },

  VOLUME_DISCOUNT_RETAIL: {
    ruleType: "VOLUME_DISCOUNT_RETAIL",
    title: "Descuento por volumen (individual)",
    summary: "Aplica un descuento porcentual sobre el carrito del catálogo individual según la cantidad total de prendas.",
    detail:
      "Reemplaza los descuentos por volumen del catálogo individual (antes hardcodeados en el código). " +
      "Se evalúa sobre el total de unidades del carrito individual y aplica el tramo de mínimo más alto alcanzado.",
    appliesTo: ["INDIVIDUAL"],
    supportedScopes: ["GLOBAL"],
    defaultBehavior: "Sin ninguna regla activa, se usan los tramos por defecto: 3+ unidades 10%, 5+ 15%, 10+ 20%.",
    fields: [
      {
        key: "tiers",
        label: "Tramos",
        description: "Lista de tramos { minItems: cantidad mínima de unidades, pct: porcentaje de descuento }.",
        example: "[{ minItems: 3, pct: 10 }, { minItems: 5, pct: 15 }, { minItems: 10, pct: 20 }]",
      },
    ],
    examples: [
      { title: "Tramos por defecto", config: { tiers: [{ minItems: 3, pct: 10 }, { minItems: 5, pct: 15 }, { minItems: 10, pct: 20 }] }, explanation: "El mismo comportamiento que existía antes hardcodeado, ahora editable desde el panel." },
    ],
    interactions: [],
    warnings: [
      "Diseñada solo para ámbito Global — no existe ningún flujo que la resuelva con contexto de marca o producto específico en el catálogo individual.",
    ],
  },
};
