# PLAN — Matriz de Datos Universal del Catálogo: Código de Estilo, Colecciones, Tipos de Producto por Marca y Motor Dinámico de Estilos (EAV híbrido)

> Destino sugerido: `docs/superpowers/plans/PLAN-matriz-datos-universal.md`
> Aplican las **Instrucciones Globales de Ejecución** (sin git commit/push, sin MCP Chrome DevTools, validación por build/lint/typecheck/Vitest, migraciones y seeds vía Drizzle ORM, reporte final en `docs/reports/`, resumen ejecutivo en el chat, sin archivos Markdown de resumen en el repo).

---

## Contexto

El catálogo actual modela los productos con campos planos: `products.category` (texto), `products.product_type` (texto suelto), `products.styles` (JSONB libre), `products.gender`, y `product_variants.fit` (texto). El SKU es obligatorio y único a nivel de variante. Existe una tabla `collections` mínima (`id`, `name`, `slug`, `brandId`) sin gestión en el admin.

El mercado de uniformes médicos exige una jerarquía real: las marcas tienen colecciones (que determinan tela/tecnología), las colecciones contienen **estilos** identificados por un código de fabricante (ej. Cherokee Infinity **2624A**), y cada estilo arropa su matriz de variantes Color × Talla. Los tipos de producto (Scrub Tops, Scrub Pants, Lab Coats...) determinan qué especificaciones de estilo aplican (Cuello V aplica a tops, Petite/Regular a pants), y esa lógica debe ser **mutable, recursiva y dependiente**: el administrador construye la taxonomía sin intervención a nivel de código.

**Objetivo:** implementar el Modelo Híbrido de Taxonomía con Atributos Dinámicos (EAV relacional para escritura + JSONB desnormalizado para lectura) descrito en `universalidad en la matriz de datos en productos de uniformes medicos.md`, reemplazando por completo los campos planos actuales.

### Jerarquía objetivo

```
[Marca] (Cherokee)
  └── [Colección] (Infinity)                       ← gestión admin nueva
        └── [CÓDIGO DE ESTILO] (2624A)             ← products.code, NUEVO NÚCLEO OBLIGATORIO, único global
              ├── Tipo de Producto (por marca) + Estilos dependientes del tipo
              └── Variantes (Color × Talla × valores de estilo):
                    ├── Navy / S  → SKU opcional
                    ├── Navy / M  → SKU opcional
                    └── Black / S → SKU opcional
```

### Decisiones ya tomadas (no reabrir)

1. **`products` = estilo.** No se crea una entidad intermedia: un registro de `products` es el contenedor del estilo. Se agrega `products.code` **obligatorio**; el SKU (producto y variante) pasa a ser **opcional**.
2. **Unicidad del Código: global.** La tripleta Marca → Colección → Estilo dispara un código que no se repite en todo el catálogo (`unique` sobre `products.code`). Es el código del fabricante, de ingreso manual.
3. **Reemplazo total.** La nueva taxonomía sustituye a `category`, `product_type` (texto), `fit` y `styles` en **todo** el sistema: admin, APIs, filtros públicos, catálogo corporativo y contexto que se entrega al motor de reglas. Los campos legacy se eliminan al final del plan.
4. **Tipos de Producto siempre por marca.** `product_types.brand_id` es obligatorio; cada marca define sus propios tipos.
5. **Valores de estilo a nivel variante** (`variant_attribute_values`), fiel al documento. Los valores que describen al estilo completo (ej. Cuello V) se propagan a todas las variantes al generar la matriz.
6. **Patrón híbrido desde el inicio.** Escritura relacional normalizada; al guardar, se desnormaliza en `product_variants.attributes_payload` (JSONB, índice GIN) y el catálogo público lee de ahí.
7. **Género (producto), Color y Talla (variante) quedan como dimensiones fijas** del esquema; el motor EAV cubre únicamente los estilos.

---

## Fase 0 — Auditoría obligatoria (sin cambios de código)

Producir una matriz de estado verificada antes de tocar nada:

1. **Inventario exhaustivo de consumidores** de `products.category`, `products.product_type`, `products.styles` y `product_variants.fit`: filtros públicos (`useProductFilter`, `FilterSidebar`, `CatalogoContent`), APIs (`/api/products` filtra por `category`), admin (`ProductForm`, listados, columnas), catálogo corporativo y armador de sets, búsqueda, seeds, y **muy especialmente el motor de reglas**: identificar si algún scope o condición usa categoría/tipo (el motor es puro — lo que cambia es el contexto que se le construye, nunca el motor).
2. **Inventario de datos reales**: valores distintos de `category`, `product_type`, `fit` y contenido de `styles` en producción/seeds; cuántos productos tienen `sku` y con qué formato (¿sirve como base para backfill de `code`?); estado actual de la tabla `collections` (¿registros? ¿algún consumidor?).
3. **Restricciones actuales de variantes**: `product_variants.sku NOT NULL UNIQUE` — mapear qué rompe al volverlo opcional (imports, armador, cotizaciones, carrito).
4. **Colisiones potenciales de `code`**: verificar contra los datos reales que el backfill propuesto (Fase 1) no produce duplicados.
5. **Coordinación con planes en curso**: el prompt `PROMPT-corporativo-layout-catalogo.md` filtra por `fit` (Corte) y categoría. Documentar el orden de ejecución recomendado entre ambos trabajos y qué se ajusta si este plan va primero o después.

Si la auditoría revela consumidores del motor de reglas acoplados a `category` de forma no trivial, detenerse y reportar antes de continuar.

---

## Fase 1 — Esquema y migraciones (Drizzle ORM)

### 1.1 Tablas nuevas

| Tabla | Campos clave | Notas |
| :---- | :---- | :---- |
| `product_types` | `id`, `brand_id` (FK **obligatoria**), `name`, `slug`, `sort_order`, `is_active` | `unique(brand_id, slug)` |
| `attributes` | `id`, `name`, `slug`, `display_type`, `sort_order`, `is_active` | Estilos/especificaciones (Modelo de Corte, Tipo de Cuello, Longitud de Pierna...) |
| `product_type_attributes` | `id`, `product_type_id`, `attribute_id`, `is_required`, `sort_order` | La regla de dependencia; `unique(product_type_id, attribute_id)` |
| `attribute_values` | `id`, `attribute_id`, `value`, `code`, `sort_order`, `is_active` | `unique(attribute_id, value)` |
| `variant_attribute_values` | `id`, `variant_id`, `attribute_value_id` | Un solo valor por atributo por variante (constraint o validación de servicio) |

### 1.2 Tablas existentes

- `collections`: ampliar con `description`, `fabric_tech`, `is_active`, `sort_order`, timestamps. `unique(brand_id, slug)` en lugar de slug único global si la auditoría lo permite (flag si hay datos que lo impidan).
- `products`: agregar `code` (text, **not null**, **unique global**) y `product_type_id` (FK a `product_types`). `sku` permanece pero documentado como opcional/informativo.
- `product_variants`: `sku` pasa a **nullable**, con unicidad parcial (`unique index ... where sku is not null`); agregar `attributes_payload` JSONB con índice **GIN**; redefinir la unicidad natural de la variante (ver Decisiones autónomas).

### 1.3 Migración de datos (obligatoria, con seeds)

1. **Backfill de `products.code`**: usar el SKU/base_code existente del producto si está presente y es único; si no, generar un código provisional determinístico (ej. `TMP-{slug}`) y **flaggear la lista de provisionales en el reporte** para corrección manual del admin.
2. **`category` → `product_types`**: crear por cada marca los tipos correspondientes a las categorías en uso (Camisas, Pantalones, Chaquetas, Batas, Accesorios → equivalentes por marca) y asignar `product_type_id` a cada producto.
3. **`fit` → EAV**: crear el atributo "Corte" con valores Petite, Short, Regular, Tall; asociarlo a los tipos tipo-pantalón (y a los que la auditoría indique); poblar `variant_attribute_values` desde `product_variants.fit`.
4. **`styles` JSONB → EAV**: mapear las claves existentes a atributos/valores donde sea coherente; lo no mapeable se reporta y se descarta con flag.
5. **Recalcular `attributes_payload`** para todas las variantes (ver Fase 2).
6. Actualizar **seeds** para que el entorno quede consistente con la nueva taxonomía (marcas → colecciones → tipos → atributos → productos con code → variantes con payload).

La eliminación física de `category`, `product_type`, `fit` y `styles` NO ocurre aquí — ocurre en la Fase 5, tras verificar cero consumidores.

---

## Fase 2 — Servicio de sincronización del payload (lógica pura + tests)

Crear un módulo puro (sin dependencias de DB en su núcleo, mismo criterio que el motor de reglas) que construya el `attributes_payload` de una variante a partir de sus relaciones:

```json
{
  "brand": "Cherokee",
  "collection": "Infinity",
  "product_type": "Scrub Pants",
  "code": "2624A",
  "styles": { "corte_pantalon": "Petite", "tipo_bolsillo": "Cargo" },
  "color_code": "NVY",
  "size": "M",
  "gender": "MUJER"
}
```

- Un servicio de persistencia lo invoca y escribe el JSONB en **cada** creación/edición de producto, variante, o cambio en la taxonomía que afecte a variantes existentes (renombrar un valor de atributo, renombrar colección, etc. → recálculo en cascada de los payloads afectados).
- **Tests Vitest obligatorios**: construcción del payload, recálculo en cascada ante renombres, variantes sin atributos, y estabilidad de claves (`slug` del atributo como clave de `styles`).

---

## Fase 3 — Panel de Administración

### 3.1 Gestión de Colecciones
CRUD completo asociado a marca: nombre, slug, descripción, tecnología de tela, activo, orden. Desde la ficha de marca se ven/gestionan sus colecciones.

### 3.2 Gestión de Tipos de Producto (por marca)
CRUD de tipos dentro de cada marca, con la sección de **estilos asociados**: asignar/quitar atributos al tipo (`product_type_attributes`), marcar obligatoriedad y orden.

### 3.3 Gestión de Estilos (Atributos) y Valores
CRUD de atributos y de sus valores (con `code` y orden). Un atributo puede asociarse a varios tipos de producto de la misma u otras marcas.

### 3.4 `ProductForm` — flujo dependiente y recursivo
1. Selecciona **Marca** → el selector de Colecciones se filtra a las de esa marca; el selector de Tipo se filtra a los tipos de esa marca.
2. Selecciona **Colección** y **Tipo** → el formulario genera dinámicamente los selectores de estilo que `product_type_attributes` declara para ese tipo, respetando `is_required`. **Principio "sin opción muerta"**: es imposible asignar a un pantalón un atributo de cuello, salvo que el admin lo haya configurado; si un tipo no tiene estilos asociados, la sección lo explica con un enlace a configurarlos.
3. **Código de Estilo**: campo obligatorio, validación de unicidad global en vivo, con el patrón visual del fabricante (ej. 2624A). SKU de producto queda como campo opcional informativo.
4. **Generador de matriz de variantes**: cruza Colores × Tallas × valores seleccionados de los estilos que multiplican variantes; los estilos de valor único para el estilo completo (ej. Cuello V) se propagan a todas las variantes generadas. SKU por variante opcional (editable celda a celda). Al guardar, se sincroniza `attributes_payload`.
5. El `ProductForm` embebido en el armador de sets (drawer, según `PLAN-ensamblador-sets-pro.md`) hereda este mismo flujo — un solo componente, sin duplicación.

---

## Fase 4 — Migración de lectura (reemplazo total)

1. **Catálogo público `/catalogo`**: el filtro Categoría pasa a alimentarse de Tipos de Producto; el filtro Corte y cualquier estilo filtrable se alimentan del EAV vía `attributes_payload` (consultas JSONB/GIN). Las opciones visibles se derivan de valores realmente presentes (sin opción muerta).
2. **APIs** (`/api/products` y relacionadas): reemplazar filtros por `category` texto por `product_type_id`/slug y filtros de estilo por payload.
3. **Catálogo corporativo y armador**: los agregados por set (colores, tallas, cortes, categorías) pasan a derivarse de la nueva taxonomía. Coordinar con `PROMPT-corporativo-layout-catalogo.md` según el orden decidido en Fase 0.
4. **Motor de reglas**: el motor (`src/lib/rules-engine/`) **no se modifica en su núcleo ni gana dependencias de DB**. Si algún scope usaba categoría, se adapta el *context builder* que le entrega los datos, manteniendo el contrato del motor. Cualquier cambio de contrato se detiene y reporta.
5. **Admin**: listados, columnas, búsquedas y filtros del panel migran a la nueva taxonomía.

---

## Fase 5 — Limpieza

Solo cuando build, typecheck y grep confirmen **cero consumidores**:

- Migración Drizzle que elimina `products.category`, `products.product_type`, `products.styles` y `product_variants.fit`.
- Actualizar seeds y documentación técnica (docs atemporales: describen cómo funciona la taxonomía, sin referencias a fases ni estados transitorios).

---

## Decisiones autónomas (resolver y flaggear en el resumen)

- **Unicidad natural de variante** tras el EAV: propuesta `unique(product_id, color_id, size, hash-de-valores-de-estilo)` o validación a nivel de servicio — decidir según soporte de Drizzle/Postgres y flaggear.
- **`display_type` de atributos**: catálogo inicial de tipos de render (select, botones, chips) y su mapeo en `SetFilterSidebar`/`FilterSidebar`.
- **Formato del código provisional** de backfill y el listado de productos que lo reciban.
- **Slug de colecciones**: global vs por marca, según datos existentes.
- Orden de ejecución respecto al prompt del layout corporativo.

## Fuera de alcance (no tocar)

- Núcleo del motor de reglas (`src/lib/rules-engine/`) — permanece puro; solo se adaptan context builders.
- Media Library, cotizaciones, carrito (más allá de lo que la auditoría de `sku` nullable exija ajustar en tipos).
- Precios y su lógica (normal/sale/descuentos) — sin cambios.
- No crear archivos Markdown de resumen; reporte de sesión en `docs/reports/`.

## Validación

- `build`, `lint`, `typecheck`, `vitest` en verde.
- Tests nuevos: servicio de payload (Fase 2), dependencia tipo→atributos en el formulario (lógica extraíble), consultas de filtrado por payload.
- Migraciones Drizzle ejecutadas + seeds ejecutados; verificación de conteos pre/post migración de datos (mismos productos, mismas variantes, cero `code` duplicados).
- Regresión: `/catalogo` y `/corporativo` devuelven los mismos ítems ante filtros equivalentes pre/post reemplazo.

## Respuesta final obligatoria

Según las Instrucciones Globales: **Resumen Ejecutivo** (incluyendo lista de códigos provisionales y claves de `styles` no mapeadas), **Verificación Manual en Producción** (checklist: crear marca→colección→tipo→atributos→producto con código→matriz de variantes; validar que un Scrub Pant no ofrece atributos de cuello; filtros públicos por tipo y por corte; SKU vacío en variante no rompe carrito/armador; unicidad de código en vivo), **Migraciones Ejecutadas**, **Builds y Validaciones**, y **Commits Sugeridos**.

Commits sugeridos de referencia (uno por fase mayor):

```bash
git commit -m "feat: agregar taxonomia universal de catalogo con codigo de estilo obligatorio, tipos de producto por marca y motor EAV de estilos"

git commit -m "feat: sincronizar attributes_payload desnormalizado en variantes y migrar lectura de filtros publicos a la nueva taxonomia"

git commit -m "feat: gestion admin de colecciones, tipos de producto y estilos con formulario de producto dependiente y matriz de variantes"

git commit -m "refactor: eliminar campos legacy category, product_type, fit y styles tras migracion completa de consumidores"
```
