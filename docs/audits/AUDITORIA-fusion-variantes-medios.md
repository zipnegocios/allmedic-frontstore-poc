# Auditoría previa — Fusión de Variantes y Medios, Portada Obligatoria y Fix de Variantes

Fecha: 2026-07-15. Auditoría de lectura previa para diagnosticar bugs, validar estructura de datos y analizar la viabilidad técnica de la fusión de tabs y la portada obligatoria.

---

## 1. Causa Raíz del Bug de Guardado de Variantes (Prioridad Máxima)

Al analizar la persistencia de las variantes en el código, se han confirmado dos problemas principales:

### A. Ausencia de Carga de Datos en el Modo Embebido (SetForm Drawer)
En `src/components/admin/SetForm.tsx`, el botón de edición de pieza abre el drawer enviando únicamente el `productId` pero sin pasar `initialData` a `ProductForm`:
```tsx
<ProductForm
  embedded
  productId={productDrawer.productId}
  initialVisibility="GROUPS"
  onCancel={() => setProductDrawer(null)}
  onSaved={async (saved) => { ... }}
/>
```
Sin embargo, `ProductForm.tsx` **no tiene ninguna lógica para consultar el producto por API cuando se le provee `productId` sin `initialData`**. Por ende, al abrir el drawer de edición en el armador de sets, el formulario se renderiza vacío (o con valores por defecto vacíos). Guardar en este estado sobrescribe el producto con datos en blanco, borrando variantes/medios o fallando por campos requeridos.
- **Solución**: Agregar un `useEffect` en `ProductForm.tsx` que, si `productId` está presente pero `initialData` no, consulte `GET /api/admin/products/[id]` para mapear el producto e inicializar el formulario con `reset(mappedData)`.

### B. Desincronización del Estado del Cliente en Ediciones Consecutivas (Stale State)
El backend en `src/lib/admin-data-service.ts` realiza un reemplazo destructivo de variantes (`DELETE` seguido de `INSERT` de todas las variantes asociadas al producto):
```typescript
await tx.delete(variantsTable).where(eq(variantsTable.productId, id));
await tx.insert(variantsTable).values(variants.map(v => ({ ...v, productId: id })));
```
Esto genera **nuevas claves primarias (UUIDs)** para cada variante insertada en la base de datos.
- En la página completa `/admin/productos/[id]`, el flujo actual hace `router.push('/admin/productos')` y `router.refresh()`. Si el usuario regresa inmediatamente a editar, Next.js podría servir la página desde el caché del enrutador del cliente o del servidor, manteniendo los IDs viejos (inexistentes en base de datos) o mostrando información desactualizada.
- Para solucionar el caché del servidor, agregaremos `export const dynamic = 'force-dynamic';` en `/src/app/admin/(dashboard)/productos/[id]/page.tsx` y en su homólogo `nuevo/page.tsx`.
- En el modo embebido (drawer), al presionar "Guardar", se llama a `onSaved?.(saved)` que cierra el drawer sin actualizar los IDs locales de la colección en memoria del formulario principal de sets. Si se vuelve a abrir de inmediato, se trabaja sobre datos stale.

---

## 2. Contrato de MediaSection y MediaPicker

En `ProductForm.tsx`, `MediaPicker` se abre y retorna los assets seleccionados:
```tsx
<MediaPicker
  open={pickerTargetIndex !== null}
  onClose={() => setPickerTargetIndex(null)}
  folder="PRODUCTS"
  segments={slugValue ? [slugValue] : []}
  multiple={pickerTargetIndex === 'append'}
  onConfirm={(assets) => {
    if (pickerTargetIndex === 'append') {
      assets.forEach((asset, i) => {
        appendImage({
          assetId: asset.id,
          colorId: '', // <- Se deja vacío por defecto (colorless)
          url: resolveMediaUrl(asset.storageKey),
          storageKey: asset.storageKey,
          mimeType: asset.mimeType,
          alt: asset.altText ?? '',
          sortOrder: imageFields.length + i,
        });
      });
    } else ...
  }}
/>
```
- **Fusión**: El botón de "Agregar desde Media Library" se moverá al interior de la card de cada color, pasando el `colorId` prefijado y bloqueando/ocultando el selector de color del medio, forzando la consistencia.
- **Validación**: El schema del formulario exigirá que todo medio del tipo `GALLERY` contenga un `colorId` válido, y que se defina explícitamente el slot de `COVER`.

---

## 3. Estructura de media_links y el Rol COVER

El rol `COVER` será explícito a nivel de base de datos.
- **Esquema**: La tabla `media_links` (`src/db/schema/media.ts`) tiene un índice único:
  `unique("uniq_media_links").on(table.entityType, table.entityId, table.colorId, table.role, table.assetId)`
  y una columna `role` que acepta texto libre con default `"GALLERY"`.
- El rol `COVER` para productos usará el patrón `replaceSingleLink` en el backend para garantizar que solo exista un registro de portada por producto.
- En la base de datos, `COVER` se guardará con `colorId = null` (portada general del producto), lo cual es 100% compatible con los constraints existentes.

---

## 4. Resolución de Portada en el Sitio Público

Actualmente, el sitio público obtiene la portada del producto asumiendo que es la primera imagen (`images[0]`) de la primera variante del producto.
Los puntos clave detectados en la auditoría son:
1. `src/app/api/products/route.ts` (API pública de catálogo)
2. `src/app/api/search/route.ts` (API pública de búsqueda)
3. `src/components/catalog/LayoutSwitcher.tsx`
4. `src/components/catalog/ProductCard.tsx`
5. `src/components/catalog/QuickViewModal.tsx`
6. `src/components/layout/Header.tsx` y `MegaMenu.tsx` (cart items / previews)
7. `src/components/product/CrossSellCard.tsx`
8. `src/app/(store)/corporativo/s/[slug]/SetDetailContent.tsx` (detalle de set corporativo)

- **Solución centralizada**: Implementar la función pura `resolveCoverMedia(product: Product): MediaItem` en `src/lib/data-service.ts`.
- **Modificación en consultas**: `fetchProductsWithJoins` en `src/lib/data-service.ts` se modificará para consultar roles `['GALLERY', 'COVER']` en la tabla `media_links` y mapear la portada a un nuevo atributo `cover` en la interfaz `Product`.

---

## 5. PDP y Galería por Color

La galería del PDP público filtra los medios basándose en el color seleccionado por el usuario. Al eliminar el tab "Medios" y asociar cada medio a un color específico de manera estricta, la galería pública no se romperá; al contrario, se simplifica su comportamiento al no requerir procesamiento de fallback complejo para imágenes "sin color".

---

## 6. Wizard Mobile

El wizard mobile en `src/components/admin/product-form/wizard-steps.ts` consta actualmente de 5 pasos:
- `identification` (Identificación)
- `pricing` (Precios y visibilidad)
- `content` (Contenido enriquecido)
- `variants` (Variantes)
- `media` (Medios)

**Ajuste**: Se fusionarán los pasos `variants` y `media` en un solo paso `variants_and_media` ("Variantes y Medios"). La definición del wizard se reducirá a 4 pasos, y se modificará `wizard-steps.ts` para validar ambos conjuntos de campos (`variants` e `images` + `cover`).

---

## 7. Ensamblador de Sets (SetForm)

El set corporativo y `getGroupEligibleProducts` esperan que cada pieza tenga una portada y un listado de variantes válidos.
- **Eligible Products**: Modificaremos `getGroupEligibleProducts` in `src/lib/admin-data-service.ts` para que obtenga la portada usando el orden prioritario: `COVER` (si existe) → `GALLERY` (primer item por `sortOrder`) → `null` (en lugar de consultar fijamente `GALLERY`).
- El drawer embebido de `ProductForm` seguirá funcionando de manera fluida y ahora cargará correctamente la información al ser abierto para edición.
