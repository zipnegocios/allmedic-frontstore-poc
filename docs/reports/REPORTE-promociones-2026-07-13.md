# Ampliación del motor de promociones — 8 tipos de PROMO

**Fecha:** 2026-07-13
**Alcance:** convertir `PROMO` de un solo tipo (`N_PLUS_ONE`) a 8 tipos configurables, todos calculados en `computeCartPricing`, todos con formulario dinámico, documentación viva y tests.

## Qué existía antes

- `PromoConfig` en `types.ts` era `{ kind: "N_PLUS_ONE" | string, buy, free }` — solo un tipo real, aunque el campo `kind` sugería que podía haber más.
- `pricing.ts` resolvía las promos por ítem (contexto `setId`/`setGroupId`/`brandId`) y aplicaba únicamente la lógica N+1.
- El formulario del panel (`RuleForm.tsx`) solo mostraba los campos `buy`/`free`, sin selector de tipo.
- El detector de conflictos ya advertía dos casos de PROMO: `PROMO_UNREACHABLE` (buy vs. máximo de `QUANTITY_RANGE`) y `DISCOUNT_ON_HIDDEN_PRICES` (descuento sobre precios ocultos).

## Qué se implementó

### 1. Tipos y validación

**`src/lib/rules-engine/types.ts`** — `PromoConfig` pasó de una interfaz única a una **unión discriminada por `kind`** con 8 miembros: `PromoNPlusOneConfig`, `PromoPercentOffConfig`, `PromoFixedAmountOffConfig`, `PromoFixedPriceConfig`, `PromoNthUnitPctConfig`, `PromoThresholdDiscountConfig`, `PromoGiftConfig`, `PromoComboConfig`. También se agregó `ResolvedPromo` (`{ id, name, config }`) porque `computeCartPricing` necesita saber qué regla concreta aportó cada descuento para armar el desglose, y `PromoBreakdownEntry`/`promoNotes` en `PricingResult`.

**`src/lib/rules-engine/resolve.ts`** — `ResolvedRules.promos` cambió de `PromoConfig[]` a `ResolvedPromo[]`. Se exportó `isRuleActive` (antes privada) porque `pricing.ts` la necesita para evaluar los tipos de nivel carrito (`THRESHOLD_DISCOUNT`, `GIFT`, `COMBO`) directamente contra `allRules`, sin pasar por la resolución jerárquica normal de `resolveRules` (que devuelve solo la regla más específica para UN contexto puntual, no "todos los ítems que caen bajo el ámbito de una regla").

**`src/lib/rule-config-schemas.ts`** — `RULE_CONFIG_SCHEMAS.PROMO` es ahora `z.discriminatedUnion('kind', [...8 miembros...]).superRefine(...)`. Los refinamientos cruzados (`THRESHOLD_DISCOUNT`: exactamente uno de `pct`/`amount`; `GIFT`: al menos una de `minQty`/`minSubtotal`) se validan con `.superRefine` sobre la unión completa, no dentro de cada miembro — Zod exige que cada miembro de un `discriminatedUnion` sea un objeto "plano" para poder indexar por el discriminante; un `.refine()` dentro de un miembro lo rompe. Las configs `N_PLUS_ONE` que ya existen en la base de datos siguen validando exactamente igual — no hizo falta ninguna migración.

### 2. Motor de cálculo (puro)

**`src/lib/rules-engine/pricing.ts`** — reescrito con el orden de aplicación documentado:

1. **Por ítem** (`N_PLUS_ONE`, `PERCENT_OFF`, `FIXED_AMOUNT_OFF`, `FIXED_PRICE`, `NTH_UNIT_PCT`) — se resuelven vía `resolveRules` con el contexto de cada set, igual que antes.
2. **`COMBO`** — se buscan directamente en `allRules` (filtrando `ruleType === 'PROMO'`, `kind === 'COMBO'`, `isRuleActive`), porque su ámbito es siempre GLOBAL y cruza dos sets distintos.
3. **`THRESHOLD_DISCOUNT`** — también se busca directamente en `allRules`; para cada regla se calcula qué ítems del carrito caen en su ámbito (`itemInRuleScope`, una función nueva que replica la lógica de `scopeMatchesContext` de `resolve.ts` pero aplicada a "qué ítems pertenecen a esta regla" en vez de "qué regla aplica a este ítem") y se suma su subtotal.
4. **`GIFT`** — mismo patrón que `THRESHOLD_DISCOUNT`, pero solo agrega texto a `promoNotes`, nunca toca un monto.

**Topes:** una función `addDiscount(setId, ...)` acumula el descuento por set en un `Map` y nunca deja que la suma supere el `lineSubtotal` de ese set — esto cubre los tipos 1-5 y `COMBO` (que sí están atados a un set concreto). `THRESHOLD_DISCOUNT` tiene su propio tope natural: nunca más que el subtotal de su propio contexto (que puede abarcar varios sets). Al final, `promoDiscountAmount` se recorta si excede `subtotalBeforeDiscount - volumeDiscountAmount`, y `total` nunca es negativo (`Math.max(0, ...)`).

### 3. Panel de administración

**`src/components/admin/RuleForm.tsx`** — el caso `PROMO` de `RuleConfigFields` ahora tiene un selector de "Tipo de promoción" con los 8 valores en español, y los campos cambian dinámicamente según el tipo elegido (`DEFAULT_PROMO_CONFIG_BY_KIND` resetea la config al cambiar de tipo). Para `COMBO`, los campos `triggerSetId`/`targetSetId` son selectores poblados con los sets reales que ya carga el formulario (mismo listado que usa el selector de ámbito "Set específico") — nunca texto libre, siguiendo el principio de no-opción-muerta de la Fase 3. El ámbito se fuerza a GLOBAL y se deshabilita el selector de ámbito mientras `kind === 'COMBO'`. Se agregó validación cliente ligera (mensajes `toast`) para los dos casos con `.superRefine` (umbral, regalo) y para exigir ambos sets en combo, antes de dejar que el servidor haga la validación real.

### 4. Detector de conflictos

**`src/lib/rules-engine/conflicts.ts`**:
- `PROMO_UNREACHABLE` (existente) se acotó a `kind === 'N_PLUS_ONE'` en ambas direcciones — es el único tipo con un campo `buy` comparable contra el máximo de `QUANTITY_RANGE`; los otros 7 no tienen ese campo y antes de este cambio `Number(undefined)` producía `NaN` silenciosamente (nunca disparaba el warning, pero tampoco era correcto dejarlo así).
- **Nuevo: `PROMO_DOUBLE_DISCOUNT`** (WARNING) — si `FIXED_PRICE` coexiste con `PERCENT_OFF` o `FIXED_AMOUNT_OFF` en el mismo contexto efectivo, se advierte que el cliente recibiría dos descuentos acumulados sobre el mismo set. No bloquea (puede ser intencional), solo avisa.
- `DISCOUNT_ON_HIDDEN_PRICES` (existente) ahora excluye `GIFT` en ambas direcciones — un regalo informativo no tiene precio que "ocultar".
- **`COMBO_SET_NOT_FOUND` / `COMBO_SET_INACTIVE`** (ERROR) — verifican que `triggerSetId`/`targetSetId` existan y estén activos. **Esta verificación no vive en `conflicts.ts`** porque ese módulo es puro (sin base de datos) por diseño; vive en `checkComboSetsExist()`, una función nueva en `src/lib/admin-data-service.ts`, invocada desde los 3 puntos donde se guardan o previsualizan reglas (`POST /api/admin/rules`, `PATCH /api/admin/rules/[id]`, `POST /api/admin/rules/check-conflicts`).

**Nota de arquitectura descubierta durante la implementación:** el primer intento puso `checkComboSetsExist` en `rule-config-schemas.ts` (junto a `toBusinessRule`), pero ese archivo lo importa `RuleForm.tsx`, un **componente cliente** — traer código que importa `db` (Postgres) ahí rompió el build (`Module not found: fs/net/tls` al intentar bundlear el driver de Postgres para el navegador). Se movió la función a `admin-data-service.ts`, que ya es exclusivamente server-side, y `rule-config-schemas.ts` volvió a quedar limpio de dependencias de base de datos.

### 5. Documentación viva

**`src/lib/rules-engine/docs.ts`** — `RULE_DOCS.PROMO` reescrito por completo: descripción de los 8 tipos con sus campos (`fields` incluye una entrada por cada campo posible de los 8 configs, indicando a qué tipo(s) pertenece cada uno), el orden de aplicación explicado en `detail`, un `example` numérico por cada uno de los 8 tipos, las interacciones nuevas (`PROMO_DOUBLE_DISCOUNT`, la verificación de sets del combo) y warnings honestos sobre las limitaciones conocidas (ver sección siguiente).

**`docs/audits/AUDITORIA-motor-reglas.md`** — sección 8 y fila del resumen ejecutivo actualizadas con fecha y referencia a este reporte.

### 6. Persistencia de las notas de `GIFT`

`POST /api/corporate/quotes` ahora registra `pricing.promoNotes` en `internalNotes` de la cotización (junto a los avisos de inventario ya existentes de `INVENTORY_MODE`), y los devuelve en la respuesta bajo `promoNotes`. El carrito (`CorporateCartDrawer.tsx`, `solicitud/page.tsx`) muestra las notas de regalo en un bloque verde con ícono de regalo, y el desglose por regla (`promoBreakdown`) debajo de "Descuento por promoción" cuando hay más de una promo activa a la vez.

**Decisión de diseño:** el prompt pedía que las notas queden "en el snapshot `items`/`customerData` de la solicitud". Se optó por reutilizar `internalNotes` (mismo mecanismo ya usado por `INVENTORY_MODE`) en vez de tocar la forma del array `items` — ese array se renderiza tal cual en `/admin/quotes/[id]` con un cast `as QuoteItem[]`, y agregarle un campo extra habría sido un cambio de forma no solicitado explícitamente. `internalNotes` es parte del mismo registro de la solicitud y ya se muestra en el detalle de la cotización en el panel admin, así que cumple el objetivo (que ventas vea y honre el regalo) sin una migración de esquema.

## Cómo se calculó cada tipo (con ejemplo numérico)

Todos los ejemplos usan un set a **$10/unidad** salvo donde se indique.

| Tipo | Fórmula | Ejemplo |
|---|---|---|
| `N_PLUS_ONE` | `floor(cantidad / buy) × free × precioUnitario` | 26 unidades, buy=13, free=1 → 2 ciclos × 1 × $10 = **$20** |
| `PERCENT_OFF` | `lineSubtotal × pct/100` | 10 unidades ($100), pct=20 → **$20** |
| `FIXED_AMOUNT_OFF` | `min(cantidad × amountPerUnit, lineSubtotal)` | 10 unidades, amountPerUnit=$3 → **$30** (o topado a $100 si amountPerUnit fuera $50) |
| `FIXED_PRICE` | `cantidad × max(0, precioNormal − price)` | 10 unidades, precio normal $10, price=$7 → 10 × $3 = **$30** |
| `NTH_UNIT_PCT` | `floor(cantidad / n) × precioUnitario × pct/100` | 6 unidades, n=2, pct=50 → 3 ciclos × $10 × 0.5 = **$15** |
| `THRESHOLD_DISCOUNT` | si `subtotalContexto ≥ minSubtotal`: `subtotalContexto × pct/100` **o** `amount` fijo, **una sola vez** | subtotal del contexto $600 ≥ minSubtotal $500, pct=10 → **$60**, aplicado una sola vez aunque el contexto tenga varios sets |
| `GIFT` | sin fórmula monetaria — condición `minQty`/`minSubtotal` cumplida → agrega `description` a `promoNotes` | 12 sets en el contexto ≥ minQty=12 → aparece el aviso, `promoDiscountAmount` no cambia |
| `COMBO` | si `cantidad(triggerSetId) ≥ triggerMinQty` y `targetSetId` está en el carrito: `lineSubtotal(targetSetId) × pct/100` | 5 unidades del set disparador (≥ triggerMinQty=5), set objetivo con subtotal $40, pct=10 → **$4** sobre el objetivo |

**Acumulación con tope:** si dos promos por ítem aplican al mismo set (ej. `PERCENT_OFF` 60% + `FIXED_AMOUNT_OFF` $8/unidad sobre 10 unidades a $10 = subtotal $100), la primera descuenta $60, dejando $40 de margen; la segunda pediría $80 pero solo se aplican los $40 restantes — el set nunca queda con descuento negativo ni el carrito con total negativo.

## Limitaciones conocidas (documentadas, no simuladas)

1. **`THRESHOLD_DISCOUNT` vs. `QUANTITY_RANGE` inalcanzable** — el prompt pedía que el detector de conflictos advirtiera cuando un `minSubtotal` es "claramente inalcanzable" dado un `QUANTITY_RANGE.max` en el mismo contexto. Esto requeriría convertir un máximo de *unidades* en un máximo de *dólares*, lo cual exige el precio de los sets involucrados — dato que `conflicts.ts` no tiene ni debe tener, porque es un módulo puro sin acceso a base de datos (la misma limitación de diseño ya documentada en el archivo para las comparaciones de ámbito). Se documentó como advertencia honesta en `RULE_DOCS.PROMO.warnings` en vez de aproximarlo con una heurística poco confiable. Mismo criterio que se usó para la interacción `MIN_QUANTITY` vs. `INVENTORY_MODE` en la fase anterior.
2. **`COMBO` no detecta ciclos** (A dispara descuento en B, B dispara descuento en A) — no se pidió explícitamente y el cálculo actual no puede entrar en un loop infinito porque cada combo se evalúa una sola vez de forma independiente sobre el estado ya calculado de `lines`, pero dos combos cruzados podrían producir un resultado que dependa del orden de las reglas en `allRules`. No se consideró suficientemente probable ni dañino como para justificar una detección de ciclos en esta fase; queda como posible mejora futura.
3. **Distribución de `THRESHOLD_DISCOUNT` entre varios sets del mismo contexto** — el descuento se registra como una sola entrada de `promoBreakdown` sobre el "contexto" (no se reparte entre los sets individuales que lo componen). Es correcto para el total, pero si en el futuro se necesita mostrar "cuánto de este descuento correspondió a este set en particular", haría falta una distribución proporcional que hoy no existe.

## Verificación

- **`npx vitest run --no-file-parallelism src/lib/rules-engine`** → **121/121 tests en verde** (86 preexistentes + 20 en `promo-pricing.test.ts` + 12 en `promo-schema.test.ts` + 3 nuevos en `conflicts.test.ts`, más los ajustes de compatibilidad en `docs.test.ts`).
- **`npm run build`** → limpio. Se detectó y corrigió en el camino un error real de bundling (`checkComboSetsExist` filtrando `db` hacia el bundle de cliente vía `RuleForm.tsx` → `rule-config-schemas.ts`) — quedó resuelto moviendo la función a `admin-data-service.ts`.
- **`npm run lint`** → **83 problemas (80 errores, 3 warnings)**, idéntico al baseline medido antes de esta sesión. Cero hallazgos nuevos en los 20 archivos tocados (verificado con `grep` sobre el output completo del lint, no solo la cola).

## Archivos creados/modificados

| Archivo | Propósito |
|---|---|
| `src/lib/rules-engine/types.ts` | `PromoConfig` → unión discriminada de 8 tipos; `ResolvedPromo`, `PromoBreakdownEntry`, `PricingResult.promoNotes` |
| `src/lib/rules-engine/resolve.ts` | `ResolvedRules.promos` devuelve `ResolvedPromo[]`; se exporta `isRuleActive` |
| `src/lib/rules-engine/pricing.ts` | Motor de cálculo de los 8 tipos, orden de aplicación, topes por set y global |
| `src/lib/rules-engine/index.ts` | Exporta `isRuleActive` |
| `src/lib/rules-engine/conflicts.ts` | `PROMO_UNREACHABLE` acotado a N+1; nuevo `PROMO_DOUBLE_DISCOUNT`; `DISCOUNT_ON_HIDDEN_PRICES` excluye GIFT |
| `src/lib/rules-engine/docs.ts` | `RULE_DOCS.PROMO` reescrito: 8 tipos, 8 ejemplos, orden de aplicación, interacciones y warnings |
| `src/lib/rule-config-schemas.ts` | `RULE_CONFIG_SCHEMAS.PROMO` como `discriminatedUnion` + `superRefine` |
| `src/lib/admin-data-service.ts` | `getSetActiveStatusByIds`, `checkComboSetsExist` (validación de sets del combo, requiere BD) |
| `src/components/admin/RuleForm.tsx` | Selector de tipo de promoción, campos dinámicos por tipo, selectores de sets para COMBO, ámbito forzado a GLOBAL |
| `src/app/api/admin/rules/route.ts` | `POST` invoca `checkComboSetsExist` para COMBO |
| `src/app/api/admin/rules/[id]/route.ts` | `PATCH` invoca `checkComboSetsExist` para COMBO |
| `src/app/api/admin/rules/check-conflicts/route.ts` | Dry-run invoca `checkComboSetsExist` para COMBO |
| `src/app/api/corporate/quotes/route.ts` | Registra `promoNotes` en `internalNotes`; los devuelve en la respuesta |
| `src/components/corporate/CorporateCartDrawer.tsx` | Desglose por regla y notas de regalo en el carrito |
| `src/app/(store)/corporativo/solicitud/page.tsx` | Desglose por regla y notas de regalo en la página de solicitud |
| `docs/audits/AUDITORIA-motor-reglas.md` | Sección 8 y resumen ejecutivo actualizados |
| `src/lib/rules-engine/__tests__/promo-pricing.test.ts` | 20 tests del motor de cálculo (nuevo) |
| `src/lib/rules-engine/__tests__/promo-schema.test.ts` | 12 tests de validación Zod por tipo (nuevo) |
| `src/lib/rules-engine/__tests__/conflicts.test.ts` | 5 tests nuevos (guard de N+1, doble descuento, exclusión de GIFT) |
| `src/lib/rules-engine/__tests__/docs.test.ts` | `CONFIG_KEYS.PROMO` ampliado; test de "tipo muerto" actualizado |

## Commit recomendado (no ejecutado)

```
git commit -m "feat: ampliar motor de promociones con 8 tipos (porcentaje, precio fijo, n-ésima unidad, umbral, regalo, combo)"
```
