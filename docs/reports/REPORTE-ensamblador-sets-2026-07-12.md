# Reporte — Ensamblador de sets pro

Fecha: 2026-07-12.

## Qué se activó

El ensamblador de sets corporativos (`admin/sets/[id]`, `SetForm.tsx`) pasa de un formulario simple (producto + cantidad en un `<select>`) a un centro de trabajo completo:

1. **Crear/editar productos sin salir del set** — botón "Crear producto nuevo" y lápiz por pieza abren `ProductForm` completo en un drawer a pantalla casi completa (`Sheet`, `sm:max-w-[90vw]`). Al guardar, la pieza recién creada/editada queda preseleccionada automáticamente en la fila que originó la acción.
2. **Selector de piezas con búsqueda** — combobox (`Command` + `Popover`) con thumbnail, nombre, marca y precio al mayor por opción; cada pieza seleccionada muestra swatches de color y tallas disponibles, y advertencias inline (sin precio, sin variantes activas, visibilidad "Solo Individual") con acción directa "Completar en la ficha" que abre el drawer de edición.
3. **Precio híbrido del set** — toggle "Fijar precio manual del set": apagado usa la suma automática de piezas (como siempre); encendido expone precio manual, precio manual rebajado y fin de vigencia, con la suma automática siempre visible al lado como referencia y un badge de delta porcentual.
4. **Reglas de este set** — tabla agrupada por tipo de regla, mostrando las de ámbito Set del set actual más las heredadas (Global, Marca, Grupo de Sets, Producto de sus piezas), con badge "Ganadora" indicando cuál gana la resolución real. Crear/editar reglas de ámbito Set se hace ahí mismo con `RuleForm` embebido y bloqueado a ese set, detector de conflictos incluido.

## Decisiones de diseño

1. **`ProductForm`/`RuleForm` ganan `embedded`/`onSaved`/`onCancel`.** `ProductForm` era dueño de layout de página completo (título, botón volver, `<div className="p-8">`) — en modo embebido ese chrome desaparece y el guardado llama `onSaved(product)` en vez de `router.push`. `RuleForm` ya era un componente "desnudo" (sin chrome propio) — solo necesitó `embedded` para omitir el `router.push` final y ganar `lockedScope` para fijar y bloquear el ámbito a `SET` + el set actual, reutilizando el mismo patrón que ya existía para forzar ámbito Global en `PROMO`/`COMBO` y `VOLUME_DISCOUNT_RETAIL`. Las páginas `products/new`, `products/[id]`, `rules/new`, `rules/[id]` no cambian: `embedded` por defecto es `false`.

2. **Visibilidad `GROUPS` preseleccionada al crear desde el set, con advertencia si se cambia a `INDIVIDUAL`.** El drawer de creación pasa `initialVisibility="GROUPS"`; si el admin la cambia a "Solo Individual" mientras crea/edita desde el ensamblador, aparece un aviso inline explicando que ese producto no será elegible como pieza — principio "sin opción muerta silenciosa" ya establecido en el proyecto.

3. **Precio manual del set — 3 nuevas columnas nullable, espejando la convención de `products`.** `corporateSets` gana `priceManual`, `priceManualSale`, `manualDiscountEnd` (`decimal(10,2)` / `timestamp with timezone`, todas nullable — `priceManual: null` es "automático", el comportamiento de siempre). La lógica de vigencia (`effectiveManualPrice`) se extrajo a un módulo puro nuevo, `src/lib/set-pricing.ts`, separado de `corporate-data-service.ts` (que sí importa la conexión a BD) específicamente para poder testear la regla de negocio con Vitest sin arrastrar la configuración de Postgres — el mismo motivo por el que `checkComboSetsExist` vive fuera de `rule-config-schemas.ts` en una sesión anterior.

4. **Un solo punto de entrada del precio hacia el motor.** La auditoría previa confirmó que `computeCartPricing` recibe `setPrices` ya resuelto desde afuera y nunca calcula desde piezas — el override solo necesitó cambiar qué valor entra en `pricePerSet` en los 3 lugares de servidor (`getActiveCorporateSets`, `getCorporateSetBySlug`, `getSetPricesByIds`). `VOLUME_SCALE` y `PROMO` no necesitaron ningún cambio de lógica: ya operan sobre el precio efectivo por diseño.

5. **Ejemplo numérico — precio manual con rebaja vigente + VOLUME_SCALE:** un set con suma automática de piezas de $10/set, override manual `priceManual: $30`, `priceManualSale: $25`, `manualDiscountEnd` en el futuro. `getSetPricesByIds` devuelve `pricePerSet: 25` (la rebaja vigente gana). Con una regla `VOLUME_SCALE` de `{minQty: 10, discountPct: 10}` y 10 sets en el carrito: subtotal `10 × $25 = $250`, descuento `10% = $25`, total `$225` — el motor nunca ve los $10 de la suma automática ni los $30 del precio manual base, solo el `$25` ya resuelto.

6. **Endpoint `GET /api/admin/sets/[id]/rules` reutiliza `resolveBestRule`** (la misma función de producción usada por el motor real) para anotar la regla ganadora por tipo — no reimplementa la lógica de resolución. Filtra a las reglas relevantes para el set (Global, Set de este set, Marca/Grupo de Sets de este set, Producto de sus piezas) para no mostrar todo el catálogo de reglas.

7. **Seguridad — `scripts/db-check.cjs`.** Tenía la cadena de conexión completa con usuario y contraseña hardcodeados. Se migró a `process.env.DATABASE_URL` (con validación temprana si falta) y se retiró el host/DB del log de consola. Se buscó en todo el repo (`grep -rlE "postgres://[a-zA-Z0-9_]+:[^@]+@"`, excluyendo `node_modules`) y no se encontró ningún otro script con credenciales embebidas. **Recomendación: rotar la contraseña `AllMedic2026ProjectNtte` del usuario `amuUser`**, ya que estuvo commiteada en texto plano en el historial de git hasta este cambio.

## Archivos creados/modificados

| Archivo | Propósito |
|---|---|
| `docs/audits/AUDITORIA-ensamblador-sets.md` | Auditoría previa (Fase 0). |
| `scripts/db-check.cjs` | Credenciales hardcodeadas → `DATABASE_URL`. |
| `src/db/schema/corporate.ts` | `corporateSets` gana `priceManual`, `priceManualSale`, `manualDiscountEnd`. |
| `src/lib/set-pricing.ts` | NUEVO — `effectiveManualPrice`, módulo puro testeable. |
| `src/lib/corporate-data-service.ts` | `getActiveCorporateSets`, `getCorporateSetBySlug`, `getSetPricesByIds` usan el precio manual cuando está vigente. |
| `src/lib/admin-data-service.ts` | `CorporateSetInput` con campos de precio; `createSetWithItems`/`updateSetWithItems` los persisten (conversión de fecha); `getGroupEligibleProducts` ampliado con imagen, colores, tallas y `hasActiveVariant`. |
| `src/app/api/admin/sets/route.ts`, `.../[id]/route.ts` | Zod: campos de precio manual + validación (rebajado < precio, vigencia requiere rebajado). |
| `src/app/api/admin/sets/[id]/rules/route.ts` | NUEVO — reglas que afectan al set, con ganadora anotada por tipo (reutiliza `resolveBestRule`). |
| `src/components/admin/ProductForm.tsx` | `embedded`, `initialVisibility`, `onSaved`, `onCancel`; advertencia de visibilidad Individual en modo embebido. |
| `src/components/admin/RuleForm.tsx` | `embedded`, `lockedScope`, `onSaved`, `onCancel`. |
| `src/components/admin/SetForm.tsx` | Reescrito: combobox de piezas, drawers de producto/regla, card de precio híbrido, tabla de reglas del set. |
| `src/app/admin/(dashboard)/sets/[id]/page.tsx` | `initialData` incluye los campos de precio manual. |
| `AGENTS.md` | Entrada `corporateSets` en Key Tables; nota de seguridad sobre `DATABASE_URL` en scripts. |
| `src/lib/__tests__/set-pricing.test.ts` | NUEVO — `effectiveManualPrice`: sin override, con override, rebaja vigente/expirada. |
| `src/lib/rules-engine/__tests__/set-price-override.test.ts` | NUEVO — `computeCartPricing` con precio efectivo (override) + interacción con `VOLUME_SCALE`. |

## Limitaciones conocidas

- **Migración de base de datos no ejecutada.** El proyecto no usa archivos de migración versionados — `npm run db:push` (`drizzle-kit push`) sincroniza el schema directamente contra la base de datos apuntada por `DATABASE_URL`, que en este entorno es una base remota no efímera. No se ejecutó para evitar tocar datos reales sin autorización explícita. **Acción requerida antes de usar el precio manual en producción:** ejecutar `npm run db:push` en un entorno controlado.
- **Verificación manual (Fase 6 del plan, curls contra base de datos real) no se ejecutó** por la misma razón — sin las columnas nuevas aplicadas, cualquier curl de prueba fallaría o (peor) escribiría contra el esquema viejo. Se recomienda repetir la Fase 6 completa (flujo de navegador, curls de precio, regla `VOLUME_SCALE` sobre precio manual, conflictos desde el drawer) después de aplicar la migración.
- **`getGroupEligibleProducts` ahora hace 3 consultas** (productos, variantes+colores, portadas) en vez de 1 — sigue siendo O(1) por carga del ensamblador (no por pieza), consistente con el patrón "loop en memoria, no N consultas" del proyecto.

## Verificación

- `npx vitest run --no-file-parallelism` → **148/148 en verde** (139 previos + 9 nuevos: 5 de `effectiveManualPrice`, 4 de `computeCartPricing` con precio efectivo).
- `npm run build` → compilación limpia (TypeScript, incluye la nueva ruta `/api/admin/sets/[id]/rules`).
- `npm run lint` → **83 problemas**, idéntico al baseline — se detectaron y corrigieron 2 hallazgos nuevos durante el desarrollo (un `eslint-disable` obsoleto en `RuleForm.tsx` y un `setState` síncrono evitable en `SetForm.tsx`) antes de este resultado final.

## Commit recomendado (no ejecutado)

```
git commit -m "feat: ensamblador de sets pro con ProductForm/RuleForm embebidos y precio hibrido"
```

**Nota:** antes de desplegar, ejecutar `npm run db:push` para aplicar las columnas `price_manual`, `price_manual_sale`, `manual_discount_end` en `corporate_sets`, y rotar la contraseña de `amuUser` en PostgreSQL.
