# Reporte de Cambios: Cotizaciones, Papelera Global y Configuración de Empresa

Este documento resume los cambios realizados para implementar el CRUD completo de cotizaciones integrado con el sistema de papelera global, y solucionar el bug de guardado de Datos de empresa.

---

## 1. Integración de Cotizaciones a la Papelera Global

### 1.1 Esquema de Base de Datos
- Se agregaron las columnas `deleted_at` (TIMESTAMPTZ) y `deleted_by` (UUID, referencia a `users.id`) en la tabla `quotes`.
- Se creó el índice `idx_quotes_deleted` sobre `quotes(deleted_at)` para optimizar búsquedas.
- El cambio se aplicó de forma segura y directa a la base de datos PostgreSQL.

### 1.2 Capa de Servicios (`src/lib/quotes/service.ts`)
- Se agregaron los siguientes servicios puros y de base de datos:
  - `softDeleteQuote(id, deletedBy)`: Marca la cotización como eliminada registrando la fecha y el administrador responsable.
  - `restoreQuote(id)`: Deshace el soft-delete limpiando los campos `deletedAt` y `deletedBy`.
  - `permanentlyDeleteQuote(id)`:
    - Borra físicamente la cotización en la base de datos (con cascada automática de partidas y documentos manuales).
    - Elimina del bucket R2 `cotizaciones` el PDF generado correspondiente a la cotización (`pdfKey`).
    - Analiza las URLs de los documentos manuales adjuntos para extraer sus claves y eliminarlos físicamente del bucket R2 `MEDIA`.
  - `listTrashedQuotes()`: Obtiene todas las cotizaciones eliminadas con sus fechas de eliminación.
- Se filtraron las consultas activas de cotizaciones para excluir las eliminadas (`deletedAt IS NULL`) en:
  - `listQuotes()`
  - `listQuotesByLeadId()`
  - `listQuotesByAccountId()`
  - `getQuotesByAccountId()` (portal del cliente en `corporate-data-service.ts`).

### 1.3 Registro Central de Papelera (`src/lib/trashable-entities.ts`)
- Se integró la entidad `QUOTE` en el registro central:
  - `getTrashedItems()`: Combina sets y cotizaciones eliminadas, y las ordena de manera descendente por la fecha de eliminación.
  - `restoreItem()`: Delega a `restoreQuote()` para la entidad `QUOTE`.
  - `permanentlyDeleteItem()`: Delega a `permanentlyDeleteQuote()` para la entidad `QUOTE`.

### 1.4 API y Endpoints
- El endpoint `DELETE /api/admin/quotes/[id]` fue modificado para realizar soft-delete (`softDeleteQuote`) en vez de hard-delete.
- El endpoint `POST /api/admin/trash` y su validador Zod `TrashActionSchema` fueron actualizados para aceptar y procesar la entidad de tipo `QUOTE`.

### 1.5 Interfaz de Usuario (UI)
- **Listado de Cotizaciones (`/admin/cotizaciones`)**:
  - Se agregó la acción "Enviar a papelera" tanto en la tabla Desktop como en las tarjetas Mobile (usando `actions` de `AdminListCard`).
  - Se implementó un diálogo de confirmación:
    - **Borradores**: Un AlertDialog estándar advirtiendo el envío a la papelera.
    - **Definitivas**: Un AlertDialog reforzado con advertencias explícitas de pérdida de acceso del cliente en su portal, requiriendo escribir la palabra de seguridad `ELIMINAR` para habilitar el botón.
- **Papelera Global (`/admin/papelera`)**:
  - Se muestran las cotizaciones eliminadas junto a los sets, identificadas por el badge "Cotización".
  - Se implementó un diálogo de eliminación definitiva reforzado que requiere escribir la palabra `ELIMINAR` para confirmar, advirtiendo el borrado físico de la cotización y todos sus archivos asociados en R2.

---

## 2. Corrección del Guardado de Datos de Empresa

### 2.1 Control de Autenticación (`src/lib/admin-auth.ts`)
- Se eliminó el uso de `redirect()` de `next/navigation` en `requireAdmin()`, ya que causaba excepciones no capturables en los API Route Handlers. Ahora lanza errores estándar (`Unauthorized`/`Forbidden`).
- Se creó la función `requireAdminPage()` que hereda este control de autenticación y realiza la redirección explícita segura para los Server Components (páginas/layouts).

### 2.2 Endpoint de Datos de Empresa (`/api/admin/quote-config/company-settings`)
- **GET**: Se actualizó para realizar un `leftJoin` con la tabla `mediaAssets` usando el campo `logoMediaId`, permitiendo retornar la URL resuelta del logo de forma automática (`logoUrl`).
- **PATCH**: Se reescribió para implementar lógica de upsert. Si la fila única (singleton) no existe en la base de datos, la crea (`insert`), y si ya existe la actualiza (`update`), evitando fallar con errores HTTP 500.

### 2.3 Formulario en Interfaz (`CompanySettingsForm.tsx`)
- Se corrigió el estado inicial: si el backend retorna `null` (tabla no sembrada), el componente inicializa un objeto con campos vacíos en lugar de quedarse en un bucle infinito de "Cargando...".
- Al montar, se inicializa el preview del logo actual si el servidor retorna `logoUrl`.
- Se realiza la coerción de campos vacíos (ej. `""`) a `null` antes de enviarlos en el body del `PATCH` para mantener la base de datos limpia.
- Se mejoró el manejo de errores informando cualquier mensaje descriptivo devuelto por el servidor.
