// ─── Documentación embebida del Motor de Reglas ───
// Fuente única de verdad para el panel admin (RuleDocPanel), tooltips y cualquier
// ayuda futura (incluido RAG). Módulo puro — sin dependencias de DB ni Next.js.
//
// IMPORTANTE: `appliesTo` y `supportedScopes` reflejan la realidad verificada en
// `docs/audits/AUDITORIA-motor-reglas.md`, no la aspiración del diseño original.
// Si una fase futura corrige un hallazgo (ej. PROMO deja de estar muerto), esta
// documentación se actualiza en el mismo commit que el fix — nunca por separado.

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
    "para ese contexto. Si dos reglas activas compiten en el mismo ámbito (mismo tipo, mismo " +
    "ámbito, mismo elemento), gana la de mayor Prioridad. Si no existe ninguna regla activa " +
    "para un tipo dado, se usan los valores por defecto del sistema.",
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
    summary: "Define cuántos sets como mínimo debe tener el carrito corporativo para poder enviar la solicitud de cotización.",
    detail:
      "Esta regla controla el botón de envío del carrito corporativo: mientras el total de sets del " +
      "carrito sea menor al mínimo, el cliente ve un mensaje como 'Agrega 4 sets más para alcanzar " +
      "el mínimo de 12' y el botón permanece deshabilitado.",
    appliesTo: ["CORPORATE"],
    supportedScopes: ["GLOBAL"],
    defaultBehavior: "Sin ninguna regla activa, el mínimo es 12 sets (unidad Sets) para el carrito completo.",
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
      { title: "Mínimo estándar", config: { min: 12, countUnit: "SETS" }, explanation: "El comportamiento por defecto del sistema — mínimo de 12 sets." },
      { title: "Mínimo reducido para institución piloto", config: { min: 6, countUnit: "SETS" }, explanation: "Útil para negociaciones especiales, pero recuerda que en ámbitos distintos a Global es solo informativo (ver advertencia)." },
      { title: "Mínimo en piezas", config: { min: 100, countUnit: "PIECES" }, explanation: "Exige 100 piezas reales en total, sin importar cuántos sets distintos las componen." },
    ],
    interactions: [
      "Si además existe una regla de Rango de cantidad (QUANTITY_RANGE) con un máximo menor a este mínimo en el mismo ámbito, ninguna cantidad satisface ambas reglas a la vez — el detector de conflictos de la Fase 4 marca esto como error.",
    ],
    warnings: [
      "Los ámbitos Set, Grupo de Sets y Marca se muestran como texto informativo en la ficha del set correspondiente ('Compra mínima: N sets'), pero NO se aplican al validar el envío del carrito — el mínimo que realmente bloquea el botón de envío siempre es el de ámbito Global, sin importar cuántos ámbitos más específicos hayas creado.",
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
    supportedScopes: ["GLOBAL", "BRAND", "SET_GROUP", "SET"],
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
      "Si el mínimo de cantidad (Rango de cantidad o Cantidad mínima) no es en sí mismo múltiplo de este valor, el mínimo real que percibe el cliente es el siguiente múltiplo hacia arriba — el detector de conflictos de la Fase 4 lo advierte.",
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
    supportedScopes: ["GLOBAL", "BRAND", "SET_GROUP", "SET"],
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
      "Si el máximo de este rango es menor que el mínimo de Cantidad mínima aplicable al mismo contexto, ninguna cantidad satisface ambas reglas — error detectado en la Fase 4.",
      "Si no existe ningún múltiplo de 'Solo múltiplos' dentro de este rango, el rango es inalcanzable — error detectado en la Fase 4.",
    ],
    warnings: [],
  },

  SIZE_MODE: {
    ruleType: "SIZE_MODE",
    title: "Modo de tallas",
    summary: "Define cómo selecciona el cliente las tallas al armar un set en el catálogo corporativo.",
    detail:
      "Cambia por completo el selector que ve el cliente en la ficha de cada set del catálogo corporativo.",
    appliesTo: ["CORPORATE"],
    supportedScopes: ["GLOBAL", "BRAND", "SET_GROUP", "SET"],
    defaultBehavior: "Sin ninguna regla activa, se usa el modo Matriz de tallas.",
    fields: [
      {
        key: "mode",
        label: "Modo",
        description: "Cómo se capturan las tallas al agregar el set al carrito.",
        options: [
          { value: "MATRIX", label: "Matriz de tallas", description: "El cliente ingresa una cantidad por cada talla disponible; todo el set (todas sus piezas) se arma en la misma talla." },
          { value: "PER_PIECE", label: "Talla independiente por pieza", description: "El cliente elige la talla de cada pieza del set por separado (ej. camisa en M, pantalón en L) y una cantidad total de sets con esa combinación." },
          { value: "NO_SIZES", label: "Sin tallas", description: "El set no maneja tallas — el cliente solo ingresa una cantidad total de sets." },
        ],
      },
    ],
    examples: [
      { title: "Matriz estándar", config: { mode: "MATRIX" }, explanation: "El comportamiento por defecto — una cantidad por talla." },
      { title: "Sin tallas", config: { mode: "NO_SIZES" }, explanation: "Para sets que no varían por talla (ej. accesorios)." },
    ],
    interactions: [],
    warnings: [],
  },

  PRICE_VISIBILITY: {
    ruleType: "PRICE_VISIBILITY",
    title: "Visibilidad de precios",
    summary: "Muestra u oculta los precios en el catálogo individual y/o corporativo.",
    detail:
      "Controla si se renderiza el precio en tarjetas de producto, ficha de detalle, menú, buscador y " +
      "carrito (catálogo individual), y en el grid y ficha de detalle de sets (catálogo corporativo).",
    appliesTo: ["INDIVIDUAL", "CORPORATE"],
    supportedScopes: ["GLOBAL", "BRAND", "SET_GROUP", "SET"],
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
    ],
    interactions: [
      "Si existen reglas de descuento (Escala por volumen, Promoción, Descuento por volumen individual) activas en un contexto donde esta regla oculta el precio, el cliente nunca ve el beneficio del descuento — el detector de conflictos de la Fase 4 lo advierte.",
    ],
    warnings: [
      "En los listados (grid de /catalogo y grid de /corporativo) SOLO se evalúa el ámbito Global — una regla de ámbito Marca, Grupo de Sets o Set no cambia lo que se ve en las tarjetas del listado. Esos ámbitos más específicos únicamente tienen efecto dentro de la ficha de detalle de un set corporativo (/corporativo/s/[slug]). Esto puede producir una inconsistencia visible: el precio aparece en la tarjeta del listado y desaparece al entrar al detalle del set.",
    ],
  },

  INVENTORY_MODE: {
    ruleType: "INVENTORY_MODE",
    title: "Modo de inventario",
    summary: "Define cómo debería comportarse el catálogo corporativo respecto al stock disponible.",
    detail:
      "Esta regla está definida en el motor pero todavía no tiene ningún efecto en el catálogo — " +
      "ningún flujo del sitio consulta esta configuración todavía. Se deja documentada para cuando " +
      "se implemente el control de inventario en ventas corporativas.",
    appliesTo: [],
    supportedScopes: [],
    defaultBehavior: "No tiene efecto en el sistema actualmente, sin importar el valor configurado.",
    fields: [
      {
        key: "mode",
        label: "Modo",
        description: "Comportamiento deseado frente al stock (planificado, no implementado todavía).",
        options: [
          { value: "IGNORE", label: "Ignorar stock", description: "El carrito corporativo no considera el inventario — coherente con el modelo de cotización referencial del negocio." },
          { value: "BLOCK", label: "Bloquear si no hay stock", description: "Planificado: impediría enviar la solicitud si excede el stock disponible. Aún no implementado." },
          { value: "INFORMATIVE", label: "Solo informativo", description: "Planificado: mostraría una advertencia no bloqueante. Aún no implementado." },
        ],
      },
    ],
    examples: [],
    interactions: [],
    warnings: [
      "Esta regla está definida pero aún no tiene efecto en el catálogo — se activará en una fase futura. Por ahora, crearla no cambia ningún comportamiento visible.",
    ],
  },

  VOLUME_SCALE: {
    ruleType: "VOLUME_SCALE",
    title: "Escala por volumen (corporativo)",
    summary: "Aplica un descuento porcentual sobre el total del carrito corporativo según el total de sets.",
    detail:
      "Se evalúa sobre el total de sets de todo el carrito (no por set individual): se busca el tramo " +
      "con el 'mínimo de sets' más alto que el carrito alcanza, y se aplica su porcentaje de descuento " +
      "sobre el subtotal completo.",
    appliesTo: ["CORPORATE"],
    supportedScopes: ["GLOBAL"],
    defaultBehavior: "Sin ninguna regla activa, no se aplica ningún descuento por volumen en el catálogo corporativo.",
    fields: [
      {
        key: "tiers",
        label: "Tramos",
        description: "Lista de tramos { minQty: cantidad mínima de sets, discountPct: porcentaje de descuento }. Se aplica el tramo de mínimo más alto que el carrito alcanza.",
        example: "[{ minQty: 12, discountPct: 0 }, { minQty: 50, discountPct: 8 }]",
      },
    ],
    examples: [
      { title: "Dos tramos", config: { tiers: [{ minQty: 12, discountPct: 0 }, { minQty: 50, discountPct: 8 }] }, explanation: "0% hasta 49 sets, 8% desde 50 sets en adelante." },
    ],
    interactions: [
      "Tramos con un 'mínimo de sets' por debajo del mínimo efectivo de Cantidad mínima nunca se alcanzan en la práctica (el carrito no puede enviarse antes de cumplir ese mínimo) — el detector de conflictos de la Fase 4 lo advierte.",
    ],
    warnings: [
      "Solo el ámbito Global tiene efecto — una regla de ámbito Marca, Grupo de Sets o Set se puede crear y guardar, pero el cálculo de precios del carrito nunca la resuelve con ese contexto específico; el resultado es idéntico a no tener esa regla.",
    ],
  },

  PROMO: {
    ruleType: "PROMO",
    title: "Promoción",
    summary: "Promociones tipo 'compra N y llévate M gratis' sobre un set del catálogo corporativo.",
    detail:
      "Se resuelve por set individual (igual que Solo múltiplos o Rango de cantidad) — una promoción de " +
      "ámbito Set solo descuenta en ese set, no en el resto del carrito. Si hay varias promociones activas " +
      "aplicables al mismo set, se acumulan. El descuento se calcula sobre la cantidad total de sets " +
      "pedidos de ese set: por cada bloque completo de 'buy' unidades alcanzado, se descuenta el precio " +
      "de 'free' unidades del total. Se muestra en el carrito como 'Descuento por promoción'.",
    appliesTo: ["CORPORATE"],
    supportedScopes: ["GLOBAL", "BRAND", "SET_GROUP", "SET"],
    defaultBehavior: "Sin ninguna regla activa, no se aplica ninguna promoción.",
    fields: [
      { key: "kind", label: "Tipo de promoción", description: "Actualmente solo existe el tipo 'N + 1' (compra N, llévate 1 más gratis).", example: "N_PLUS_ONE" },
      { key: "buy", label: "Compra (buy)", description: "Cantidad que el cliente debe comprar (dentro del mismo set) para activar un ciclo de la promoción.", example: "13" },
      { key: "free", label: "Gratis (free)", description: "Cantidad de unidades adicionales gratuitas por cada bloque de 'buy' alcanzado.", example: "1" },
    ],
    examples: [
      { title: "13 + 1", config: { kind: "N_PLUS_ONE", buy: 13, free: 1 }, explanation: "Por cada 13 unidades compradas de ese set, 1 es gratis. Con 26 unidades, se descuentan 2." },
    ],
    interactions: [
      "Si el ámbito de esta promoción exige más unidades (buy) que el máximo permitido por Rango de cantidad en el mismo contexto, la promoción nunca se activa — el detector de conflictos de la Fase 4 lo advierte.",
      "Si Visibilidad de precios oculta el precio en el contexto donde esta promoción aplica, el cliente no ve el descuento reflejado (el total sigue siendo correcto, pero no hay forma de mostrar 'ahorraste $X' sin mostrar precios).",
    ],
    warnings: [],
  },

  COLOR_RESTRICTION: {
    ruleType: "COLOR_RESTRICTION",
    title: "Restricción por color",
    summary: "Exige una cantidad mínima cuando el cliente elige un color específico.",
    detail:
      "Esta regla está definida en el motor, pero el carrito corporativo todavía no tiene ningún " +
      "selector de color en sus 3 modos de talla (Matriz, Talla por pieza, Sin tallas) — no hay forma " +
      "de que el cliente elija un color al armar su pedido, así que la condición de esta regla nunca " +
      "se cumple, sin importar la configuración.",
    appliesTo: [],
    supportedScopes: [],
    defaultBehavior: "No tiene efecto en el catálogo corporativo actualmente — no existe selector de color en el carrito.",
    fields: [
      { key: "colorCode", label: "Código de color", description: "Código del color al que aplica la restricción. Actualmente texto libre — no se valida contra la tabla de colores real.", example: "PINK" },
      { key: "min", label: "Mínimo requerido", description: "Cantidad mínima exigida cuando se elige ese color.", example: "6" },
    ],
    examples: [],
    interactions: [],
    warnings: [
      "Esta regla está deshabilitada para crear desde el panel: no existe selector de color en el carrito corporativo todavía, así que ninguna configuración de esta regla puede tener efecto.",
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
