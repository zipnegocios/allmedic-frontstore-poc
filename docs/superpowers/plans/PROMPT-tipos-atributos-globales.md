# Prompt de Adecuación — Tipos de Producto y Atributos de Estilo Globales, Reutilizables y con Activación por Marca

> Destino sugerido: `docs/superpowers/plans/PROMPT-tipos-atributos-globales.md`
> Adecuación estructural sobre lo implementado por `PLAN-matriz-datos-universal.md`.
> Aplican las **Instrucciones Globales de Ejecución** (sin git commit/push, sin MCP Chrome DevTools, validación por build/lint/typecheck/Vitest, migraciones y seeds vía Drizzle ORM, reporte final en `docs/reports/`, resumen ejecutivo en el chat, sin archivos Markdown de resumen en el repo).

---

## Contexto y problema

La matriz de datos implementó `product_types.brand_id` como obligatorio (tipos por marca). El efecto en producción es visible en el filtro público **TIPO DE PRODUCTO**: "Camisas" aparece tres veces y "Pantalones" dos, porque cada marca declaró su propia copia del mismo tipo. Lo mismo ocurre con los atributos de estilo: Koi y Cherokee pueden tener camisas con Cuello V, y el enfoque actual obliga a crear dos veces el mismo atributo, duplicándolo en los esquemas.

**Corrección estructural:** los Tipos de Producto y los Atributos de Estilo son **entidades globales, paralelas y reutilizables**. La marca no es dueña de la taxonomía; la consume. La asociación al producto es *on demand*.

### Jerarquía corregida

```
[Tipos de Producto]  ← catálogo GLOBAL único (Camisas, Pantalones, Chaquetas...)
[Atributos de Estilo] ← catálogo GLOBAL único (Modelo de Corte, Tipo de Cuello...)
        │
        ├── brand_product_types  ← activación: qué tipos ofrece cada marca
        └── product_type_attributes ← dependencia: qué estilos aplica cada tipo (sin marca)

[Marca] (Cherokee)
  └── [Colección] (Infinity)
        └── [CÓDIGO DE ESTILO] (2624A) → tipo global activado para la marca + estilos del tipo
              └── Variantes (Color × Talla × valores de estilo)
```

### Decisiones ya tomadas (no reabrir)

1. **Tipos de Producto globales** con **activación por marca**: catálogo único (`product_types` sin `brand_id`), más tabla `brand_product_types` que declara qué tipos tiene activados cada marca. El selector de Tipo en `ProductForm` se filtra por la activación de la marca elegida.
2. **Atributos de Estilo globales y reutilizables**: un mismo atributo (ej. *Tipo de Cuello*) se asocia a los tipos que lo requieran vía `product_type_attributes`, sin copia por marca. Si la implementación o los datos introdujeron cualquier anidación de atributos bajo marca, se elimina.
3. **Deduplicación en migración**: fusión automática de duplicados **exactos** (mismo nombre/slug normalizado) + **mapa semántico explícito**: `Pants → Pantalones`, `Tops → Camisas`. Cualquier otro duplicado semántico detectado en Fase 0 que no esté en el mapa se **reporta para fusión manual**, no se fusiona por adivinación.
4. Se mantienen intactas las demás decisiones de la matriz universal: `products.code` único global obligatorio, SKU opcional, valores de estilo a nivel variante, `attributes_payload` JSONB como lectura pública, Género/Color/Talla como dimensiones fijas.

---

## Fase 0 — Auditoría obligatoria (sin cambios de código)

1. **Inventario de duplicados reales** en `product_types`, `attributes` y `attribute_values`: agrupar por nombre/slug normalizado (case-insensitive, sin acentos) y clasificar en exactos / cubiertos por el mapa semántico / semánticos no mapeados (estos últimos van al reporte).
2. **Consumidores de `product_types.brand_id`**: esquema Drizzle, servicios, admin (gestión anidada en marca), `ProductForm`, APIs, filtros públicos, agregados del corporativo, seeds.
3. **Estado de `attributes_payload`**: confirmar qué campos del payload quedarán obsoletos tras las fusiones (ej. el nombre del tipo cambia de "Pants" a "Pantalones") para dimensionar el recálculo en cascada.
4. **Verificar unicidad post-fusión**: que `unique(slug)` global en `product_types` y `unique(attribute_id, value)` en valores no colisionen tras aplicar fusiones.

Si la auditoría contradice supuestos del plan (ej. `brand_id` usado en lógica de negocio no inventariada aquí), detenerse y reportar.

---

## Fase 1 — Esquema y migración de datos (Drizzle ORM)

Orden estricto dentro de la migración (idempotente):

1. **Crear `brand_product_types`**: `id`, `brand_id` (FK), `product_type_id` (FK), `sort_order`, timestamps; `unique(brand_id, product_type_id)`.
2. **Fusión de tipos**: por cada grupo de duplicados (exactos + mapa `Pants→Pantalones`, `Tops→Camisas`), elegir el registro canónico (el del nombre destino; si empatan, el más antiguo), re-apuntar `products.product_type_id` y `product_type_attributes.product_type_id` (fusionando asociaciones de estilos sin duplicar pares), y eliminar los registros absorbidos.
3. **Sembrar activaciones**: por cada marca, activar en `brand_product_types` los tipos que esa marca poseía antes de la fusión **y** los tipos de los productos que la marca tiene publicados (unión de ambos criterios).
4. **Fusión de atributos y valores** con el mismo criterio (exactos automáticos; semánticos solo si están en el mapa; resto a reporte), re-apuntando `product_type_attributes` y `variant_attribute_values`.
5. **Eliminar `product_types.brand_id`** y aplicar `unique(slug)` global; ajustar `unique` de atributos/valores según corresponda.
6. **Recalcular `attributes_payload`** de todas las variantes afectadas por fusiones (nombres canónicos nuevos).
7. **Seeds** actualizados a la estructura global + activaciones, idempotentes.

Reglas: nunca borrar un tipo/atributo con productos apuntando antes de re-apuntar; conteos pre/post idénticos de productos y variantes; cero huérfanos en tablas de asociación.

---

## Fase 2 — Panel de Administración

1. **Tipos de Producto** pasa a ser una sección **global** del admin (deja de estar anidada en marca): CRUD + su sección de estilos asociados (`product_type_attributes`), igual que hasta ahora pero sin marca.
2. **Ficha de marca**: nueva sección **"Tipos activados"** — checklist de los tipos globales con activar/desactivar (gestiona `brand_product_types`). Desactivar un tipo con productos existentes de esa marca no borra nada: muestra advertencia con conteo y solo impide usarlo en productos nuevos.
3. **Atributos de Estilo**: sección global (si ya lo era, verificar que ninguna vista los filtre por marca).
4. **`ProductForm`**: al elegir Marca, el selector de Tipo ofrece **solo los tipos activados** para esa marca. Principio "sin opción muerta": si la marca no tiene tipos activados, la sección lo explica con enlace directo a la ficha de marca para activarlos — nunca un selector vacío sin explicación.

---

## Fase 3 — Lectura pública y corporativo

1. **Filtro TIPO DE PRODUCTO** en `/catalogo`: con la fusión, los duplicados desaparecen por sí solos; verificar que las opciones se derivan de tipos presentes en productos publicados (una sola entrada por tipo).
2. **Filtros de estilo** (Corte, etc.): verificar que leen valores canónicos post-fusión desde `attributes_payload`.
3. **Corporativo**: los agregados por set (categorías/tipos, cortes) reflejan los nombres canónicos; verificar `useSetFilter`/`SetFilterSidebar`.
4. **Motor de reglas**: sin cambios en su núcleo. Si algún context builder entregaba el tipo por marca, ajustar solo el builder.

---

## Decisiones autónomas (resolver y flaggear en el resumen)

- Normalización exacta usada para detectar duplicados (case/acentos/espacios) y el registro canónico elegido en cada fusión (listar todas las fusiones aplicadas en el reporte).
- Si `attribute_values` presenta valores equivalentes con códigos distintos (ej. "Cuello V" con `code` diferente por duplicación), criterio de código canónico.
- Comportamiento del filtro del selector de Colección cuando la marca cambia tras haber elegido tipo.

## Fuera de alcance (no tocar)

- Núcleo del motor de reglas (`src/lib/rules-engine/`).
- Código de Estilo, SKU opcional, matriz de variantes, Media Library, precios, cotizaciones.
- No crear archivos Markdown de resumen; reporte de sesión en `docs/reports/`.

## Validación

- `build`, `lint`, `typecheck`, `vitest` en verde.
- Tests: fusión (función pura de deduplicación con casos exactos, mapa semántico y no-mapeados), filtrado del selector por activación de marca, recálculo de payload con nombres canónicos.
- Verificación de datos post-migración: cero duplicados por slug normalizado en tipos y atributos; conteos de productos/variantes idénticos pre/post; cero referencias huérfanas.
- Regresión visual/funcional: el filtro TIPO DE PRODUCTO muestra cada tipo una sola vez.

## Respuesta final obligatoria

Según las Instrucciones Globales: **Resumen Ejecutivo** (incluyendo la lista completa de fusiones aplicadas y los duplicados semánticos no mapeados que requieren fusión manual), **Verificación Manual en Producción** (checklist: filtro de tipos sin duplicados; crear producto Koi con tipo "Camisas" reutilizando el atributo *Tipo de Cuello* ya existente sin recrearlo; activar/desactivar tipos desde la ficha de marca; marca sin tipos activados muestra explicación con enlace; corporativo con nombres canónicos), **Migraciones Ejecutadas**, **Builds y Validaciones**, y **Commits Sugeridos**.

Commit sugerido de referencia:

```bash
git commit -m "refactor: convertir tipos de producto y atributos de estilo en catalogos globales reutilizables con activacion por marca y deduplicacion de registros existentes"
```
