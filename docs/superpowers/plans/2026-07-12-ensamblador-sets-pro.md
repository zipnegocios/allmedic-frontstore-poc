# PLAN — Ensamblador de sets pro: ProductForm embebido, precio híbrido del set y reglas en contexto

> Prompt de ejecución para Claude Code. Todo el copy, comentarios y docs en **español (Ecuador)**.
> Commits `feat:` / `fix:` / `docs:`. Sin errores de lint. El motor de reglas (`src/lib/rules-engine/`) **permanece puro, sin dependencias de DB**.

---

## Contexto y objetivo

El ensamblador de sets (`admin/sets`, `SetForm.tsx`) hoy solo permite elegir producto + cantidad en un `<select>`. Debe convertirse en un centro de trabajo completo: gestionar variantes e imágenes de cada pieza, **crear productos nuevos sin salir del set**, fijar precios (por pieza y a nivel de set) y gestionar las reglas del motor que afectan al set — todo reutilizando los componentes existentes como única fuente de verdad.

### Decisiones ya tomadas (NO reabrir)

1. **Integración de productos:** `ProductForm` completo **embebido en drawer/modal** a pantalla casi completa. Nada de formularios reducidos paralelos ni navegación con retorno. Un solo formulario de producto en todo el admin.
2. **Precio del set — híbrido:** automático por defecto (suma de precios al mayor de piezas × cantidad, como hoy). Toggle **"Fijar precio manual del set"** que habilita una estructura de precios propia; cuando está activo, la suma calculada sigue **siempre visible como referencia** junto al precio manual.
3. **Reglas del motor — sección embebida:** el ensamblador muestra las reglas de ámbito `SET` del set **más las heredadas** (`GLOBAL`, `BRAND`, `SET_GROUP` y `PRODUCT` de sus piezas) en solo lectura indicando cuál ganaría la resolución por tipo. Crear/editar reglas de ámbito `SET` se hace ahí mismo con `RuleForm` en drawer, con su detector de conflictos funcionando.

### Decisiones menores resueltas (implementar tal cual, documentar)

- **Visibilidad de productos creados desde el set:** preseleccionar `GROUPS` (con el selector visible y editable, y su texto de ayuda). Un producto `INDIVIDUAL` no sería elegible como pieza — si el admin lo elige, mostrar advertencia inline explicando por qué no aparecerá en el set (principio "no dead option": ninguna combinación silenciosamente inútil).
- **Refactor de navegación, no de lógica:** `ProductForm` y `RuleForm` ganan props `embedded?: boolean`, `onSaved?: (entity) => void`, `onCancel?: () => void`. En modo embebido: sin `router.push`, sin encabezado de página propio, `RuleForm` con `scope` prefijado y **bloqueado** a `SET` + `scopeId` del set actual. Las páginas actuales (`products/new`, `products/[id]`, `rules/...`) quedan como wrappers delgados — cero duplicación.
- **Sección de reglas solo en modo edición:** requiere `setId`. En creación de set, mostrar el bloque deshabilitado con el aviso "Guarda el set para gestionar sus reglas".
- **Al guardar un producto desde el drawer:** refrescar el listado `eligible-for-sets` y **preseleccionar automáticamente** el producto recién creado en la fila de pieza que originó la acción.
- **Seguridad (hacer en esta sesión):** `scripts/db-check.cjs` tiene la cadena de conexión de PostgreSQL con credenciales hardcodeadas. Migrar a `process.env.DATABASE_URL`, verificar que ningún otro script del repo tenga credenciales embebidas, y dejar nota en el reporte recomendando rotar esa contraseña.

---

## Fase 0 — Auditoría previa (obligatoria antes de tocar código)

Producir `docs/audits/AUDITORIA-ensamblador-sets.md` verificando en el código real:

1. **`ProductForm.tsx`:** todos los puntos de navegación/efectos de página (router.push, toasts de redirección, carga de brands/colors/collections) que el modo embebido debe neutralizar. Contrato exacto del submit (endpoint, payload).
2. **`RuleForm.tsx`:** props actuales, cómo carga `scopeOptions`, cómo invoca el detector de conflictos (dry-run debounced), qué asume de la página contenedora.
3. **Schema de `sets` (Drizzle):** confirmar que NO existe hoy campo de precio propio → definir la migración (nombres siguiendo las convenciones del schema existente; espejo de los campos de precio al mayor del producto: precio manual, precio manual rebajado, fin de vigencia de la rebaja).
4. **Cálculo del precio del set:** todos los puntos donde se computa la suma de piezas (`corporate-data-service`, `computeCartPricing`, vista previa del `SetForm`, ficha corporativa) — ahí aplicará el override.
5. **Orden de precedencia precio × reglas:** confirmar cómo `VOLUME_SCALE` y `PROMO` toman el precio base del set hoy, para definir que operan **sobre el precio efectivo** (override si existe, suma si no).
6. **`/api/admin/products/eligible-for-sets`:** criterio de elegibilidad exacto (visibilidad, activo).

Si algo contradice este plan, detenerse y reportar antes de continuar.

## Fase 1 — `ProductForm` embebible + drawer en el ensamblador

- Refactor de `ProductForm` según las decisiones menores. Las páginas existentes no cambian de comportamiento (verificar manualmente que crear/editar producto desde `admin/products` sigue idéntico).
- En `SetForm`, por cada fila de pieza:
  - Botón **"Editar producto"** (ícono lápiz) → drawer con `ProductForm` en modo edición de esa pieza.
  - Botón global **"Crear producto nuevo"** en la sección Piezas → drawer con `ProductForm` en modo creación (visibilidad preseleccionada `GROUPS`).
- Drawer: `Sheet` de shadcn/ui a ancho casi completo (`sm:max-w-[90vw]` o similar), scroll interno, confirmación antes de cerrar con cambios sin guardar.

## Fase 2 — Selector de piezas mejorado

- Reemplazar el `<select>` simple por un **combobox con búsqueda** (patrón `Command` de shadcn/ui): thumbnail del producto, nombre, marca y precio al mayor visibles en cada opción.
- Por pieza seleccionada, mostrar un **resumen de variantes**: colores disponibles (swatches), tallas, y advertencias inline cuando falte algo que rompa el flujo corporativo — sin precio al mayor, sin variantes activas, visibilidad `INDIVIDUAL`. Cada advertencia con acción directa: "Completar en la ficha" abre el drawer de edición ya posicionado (anclado) en la sección correspondiente.
- Mantener la vista previa de precio referencial existente, ahora alimentada también por el estado del toggle de la Fase 3.

## Fase 3 — Precio híbrido del set

- **Migración Drizzle** con los campos definidos en Fase 0 (nullable; `null` = automático).
- **UI en `SetForm`:** card "Precio del set" con toggle "Fijar precio manual del set". Apagado: muestra la suma automática (como hoy). Encendido: campos de precio manual (precio, precio rebajado, fin de vigencia) **y** la suma automática al lado como referencia, con un badge de delta (ej. "−12% vs. suma de piezas") para que el admin vea de inmediato si vende por encima o debajo del agregado.
- **Backend:** API de sets acepta y valida los campos (zod: rebajado < precio, vigencia coherente). `corporate-data-service` y `computeCartPricing` usan el precio manual cuando está definido y vigente; expirada la vigencia del rebajado, cae al precio manual base; sin override, suma como siempre.
- **Reglas sobre el precio efectivo:** `VOLUME_SCALE` y `PROMO` aplican sobre el precio resultante (override o suma). El motor sigue puro: el precio base entra como parámetro/snapshot. Actualizar `RULE_DOCS` de ambos tipos si su texto menciona "suma de piezas" — reflejar la semántica nueva.
- Tests Vitest: pricing con override activo, override con rebaja vigente/expirada, sin override, e interacción con `VOLUME_SCALE`.

## Fase 4 — Sección "Reglas de este set"

- **Endpoint** `GET /api/admin/sets/[id]/rules`: devuelve las reglas que afectan al set — ámbito `SET` (scopeId = set), heredadas `GLOBAL`/`BRAND`/`SET_GROUP`, y `PRODUCT` de sus piezas — anotando por tipo de regla **cuál ganaría la resolución** (reusar la misma lógica de resolución de producción, no reimplementarla).
- **UI en `SetForm` (solo edición):** tabla agrupada por tipo de regla con badge de ámbito, estado activa/inactiva, e indicador "ganadora". Heredadas en solo lectura con enlace al panel de reglas. Botones "Nueva regla para este set" y editar (solo ámbito `SET`) → drawer con `RuleForm` embebido, scope bloqueado, detector de conflictos operativo.
- Al guardar/eliminar una regla, refrescar la tabla y re-anotar ganadoras.

## Fase 5 — Documentación y seguridad

- Actualizar `AGENTS.md` (nuevo alcance del ensamblador) y `RULE_DOCS` afectados (Fase 3).
- Limpieza de credenciales en `scripts/db-check.cjs` (ver decisiones menores).
- Reporte `docs/reports/REPORTE-ensamblador-sets-<fecha>.md`: decisiones, migración, precedencia de precios, refactors de embebido.

## Fase 6 — Verificación manual (cierre obligatorio)

1. Flujo completo en navegador: crear set → crear producto desde el drawer (queda preseleccionado en la fila) → editarlo desde el lápiz → resumen de variantes refleja los cambios.
2. `curl`: `POST/PUT` de set con precio manual → `GET` de la ficha corporativa confirma que el precio mostrado es el override; quitar el override → vuelve la suma.
3. Regla `VOLUME_SCALE` activa sobre un set con precio manual: el descuento se calcula sobre el override (verificar con curl al pricing del carrito corporativo).
4. Crear una regla de ámbito `SET` desde el drawer: aparece en la tabla como ganadora donde corresponda; el detector de conflictos bloquea un conflicto ERROR desde el drawer igual que en el panel.
5. Regresión: `admin/products/new` y `admin/rules` funcionan idéntico que antes del refactor.
6. `npm run lint` y suite Vitest en verde.

---

## Restricciones finales

- Motor de reglas puro — precios y snapshots entran como parámetros.
- Reutilizar componentes existentes (`ProductForm`, `RuleForm`, `MediaPicker`, patrones de `Command`/`Sheet` de shadcn/ui); no crear formularios paralelos.
- Todo copy/comentarios/docs en español (Ecuador).
- Documentación en la misma sesión, no después.
