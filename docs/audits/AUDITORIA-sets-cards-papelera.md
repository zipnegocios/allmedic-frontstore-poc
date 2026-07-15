# Auditoría Previa — Sets en Cards, Portada del Set y Papelera General

Auditoría técnica realizada sobre el estado actual de los sets corporativos, su visualización, lógica de eliminación, enlaces de medios y esquema de base de datos para habilitar la grilla de cards, la portada propia y la papelera general.

---

## 1. Verificación de Dependencias
- **Rol `COVER`:** Confirmado en `src/db/schema/media.ts` (L69) como uno de los valores válidos para el campo `role` de la tabla `media_links`.
- **Helper `resolveCoverMedia`:** Confirmado y exportado en `src/lib/data-service.ts` (L621). Soporta fallbacks automáticos y resuelve la portada de productos.

---

## 2. Listado Actual de Sets
- **Página de Listado:** Habilitada en la ruta cliente `src/app/admin/(dashboard)/sets/page.tsx` (L1-193).
- **Consumo de API:** Consume el endpoint `GET /api/admin/sets` que a su vez llama a `getAdminSets()` en `src/lib/admin-data-service.ts` (L688).
- **Acciones Actuales:** El listado actual es una tabla (`Table`) con columnas básicas y un botón destructivo que invoca al endpoint `DELETE /api/admin/sets/[id]`. En mobile, renderiza una lista de componentes `<AdminListCard />`.
- **Patrón de Toggle:** No existe un patrón de toggle de vistas en sets (es tabla pura en desktop y lista apilada en mobile). Se reemplazará la tabla desktop directamente con la grilla de cards.

---

## 3. Eliminación Actual de Sets
- **Endpoint de Eliminación:** `DELETE /api/admin/sets/[id]` en `src/app/api/admin/sets/[id]/route.ts`. Invoca `deleteSet(id)` de `admin-data-service.ts`.
- **Cascadas de Base de Datos:** De forma nativa, la tabla `set_items` tiene clave foránea con `onDelete: "cascade"` sobre `corporateSets.id`. La tabla `media_links` para sets no posee FK física con cascada al ser un enlace polimórfico (basado en `entityType` y `entityId`). Actualmente `deleteSet` elimina el registro del set en `corporate_sets` provocando la cascada en `set_items` pero dejando huérfanos los registros en `media_links` (se corregirá en la eliminación permanente).
- **Referencias Externas (Cotizaciones):** La tabla `quote_items` posee FK opcional con `setId` referenciando a `corporate_sets.id`. No posee cascada. Al borrar definitivamente un set, Drizzle/Postgres fallará si existen cotizaciones referenciándolo (se mantendrán seguras en la papelera gracias al soft delete; la eliminación definitiva requiere el manejo de estas cotizaciones).

---

## 4. Puntos de Consumo del Filtro `deletedAt`
El filtro `deletedAt IS NULL` debe agregarse en:
- `getAdminSets` en `src/lib/admin-data-service.ts` (listado admin general).
- `getActiveCorporateSets` en `src/lib/corporate-data-service.ts` (catálogo público).
- `getCorporateSetBySlug` en `src/lib/corporate-data-service.ts` (detalle de set público).
- `checkComboSetsExist` en `src/lib/admin-data-service.ts` (auditoría del motor de reglas para promociones de combo).

---

## 5. Vínculo `media_links` con Sets
- **Asociación en DB:** La tabla `media_links` conecta con sets utilizando `entityType = 'SET'` y `entityId = set.id`.
- **Estado en `SetForm.tsx`:** Ya cuenta con una llamada a `<MediaPicker folder="SETS" />` (L422) que guarda `coverAssetId` en el estado plano, y la API procesa este campo llamando a `replaceSingleLink('SET', id, 'COVER', coverAssetId)` al guardar/editar el set. Sin embargo, no se expone un objeto `cover` completo ni texto alternativo (`alt`), y es opcional.

---

## 6. Integración de la Portada en `SetForm`
- La tarjeta de portada se ubicará en `GeneralSection.tsx` de sets, reemplazando el selector plano actual por la tarjeta interactiva de portada (`cover` con campos anidados de assetId, url, storageKey, mimeType, alt), alineando visualmente y por validación con el formulario de productos.

---

## 7. Navegación Administrativa
- **Sidebar Desktop:** Se agregará la ruta `/admin/papelera` en `src/components/admin/AdminSidebar.tsx` debajo de "Configuración".
- **Bottom Nav Mobile:** Se agregará la misma ruta en `moreItems` dentro de `src/components/admin/AdminBottomNav.tsx`, permitiendo acceder desde el drawer "Más" de la navegación inferior mobile.
- **Card Mobile actual:** El listado mobile ya renderiza tarjetas compactas apiladas. Se actualizará para renderizar solo la portada del set como thumbnail y ocultar la lista de piezas.
