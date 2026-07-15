# Reporte Técnico — Sets Corporativos en Cards, Portada Propia y Papelera General

**Fecha:** 2026-07-15  
**Market/Localización:** Ecuador (Español)  
**Autor:** Antigravity AI  

---

## 1. Resumen Ejecutivo
Se implementó de manera exitosa la reestructuración completa del panel administrativo de conjuntos (sets) corporativos de ropa médica. Los cambios abarcan:
1. **Filtro de Soft Delete y Portada:** Vínculo de portada obligatoria (`COVER`) para conjuntos, exclusión de conjuntos inactivos/borrados del catálogo público y consultas administrativas.
2. **Presentación Premium en Cards:** Reemplazo de la antigua tabla plana en `/admin/sets` por una grilla moderna y responsive de cards con miniaturas de las piezas que componen cada set, switch optimista de estado y envío a papelera.
3. **Papelera General:** Creación de un panel unificado de recuperación de elementos en `/admin/papelera`, respaldado por el endpoint extensible `/api/admin/trash`.

---

## 2. Cambios en Base de Datos e Infraestructura
* **Tabla `corporate_sets`:**
  * Nueva columna `deleted_at` (`timestamp with time zone`, nullable).
  * Nuevo índice `idx_corporate_sets_deleted` sobre la columna `deleted_at`.
* **Tabla `quote_items`:**
  * Se modificó la clave foránea `quote_items_set_id_corporate_sets_id_fk` configurando `ON DELETE SET NULL` para asegurar la persistencia histórica de cotizaciones existentes cuando su set originario sea enviado a la papelera o eliminado permanentemente.
* **Migración:** Ejecutada manualmente mediante el runner de base de datos debido a advertencias falsas de introspección en drizzle-kit (`uniq_media_links` preexistente) en ambientes TTY no interactivos.

---

## 3. Arquitectura y Nuevos Componentes

### 3.1 Servicios y Datos (`admin-data-service.ts` & `corporate-data-service.ts`)
* `softDeleteSet(id)`: Registra la fecha de baja lógica.
* `restoreSet(id)`: Limpia el campo `deletedAt`.
* `permanentlyDeleteSet(id)`: Ejecuta una transacción ACID que remueve piezas del set, enlaces polimórficos de `media_links`, reglas de negocio asociadas en `business_rules`, y el set.
* `getTrashedSets()`: Lista los sets actualmente eliminados ordenados por fecha descendente.
* Modificación de consultas públicas para excluir sets con `deletedAt IS NOT NULL`.

### 3.2 Registro de Papelera (`trashable-entities.ts` & `/api/admin/trash`)
* Se definió un registro unificado para centralizar operaciones de listado, restauración y purga física de cualquier modelo papelerable del sistema.
* El endpoint `/api/admin/trash` expone métodos `GET` (listar elementos eliminados) y `POST` (ejecutar acciones de `restore` o `delete`).

### 3.3 Vistas de Usuario (Cards y Papelera)
* `/admin/sets`: Grid responsivo en 1 col (mobile) y hasta 3 cols (desktop). Los componentes muestran miniaturas de las piezas correspondientes, switch interactivo de activación y botón de eliminación suave con banner toast de deshacer inmediato. En mobile se omiten las miniaturas de piezas para cuidar la visualización vertical.
* `/admin/papelera`: Listado unificado con buscador en tiempo real, fecha de baja y diálogos nativos de confirmación destructiva.
* Enlaces en menú lateral (`AdminSidebar.tsx`) y menú móvil (`AdminBottomNav.tsx`).

---

## 4. Pruebas y Validación
* **Vitest:** Se actualizaron los tests del wizard de pasos del formulario de sets (`wizard-steps.test.ts`) para incluir el nuevo campo requerido `coverAssetId`.
* **Linter y Typecheck:** Validado sin errores en el compilador de TypeScript (`npx tsc --noEmit`) y ESLint.
* **Build de Producción:** Next.js compiló satisfactoriamente todas las rutas estáticas y dinámicas en la primera corrida de optimización.
