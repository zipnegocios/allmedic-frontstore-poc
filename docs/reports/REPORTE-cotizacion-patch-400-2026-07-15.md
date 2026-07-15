# Reporte — Fallo al generar cotización definitiva (PATCH 400) en `/admin/cotizaciones`

## Causa raíz confirmada

`quoteItems.pricingBreakdown` tiene **dos formas legítimas** según el origen de la línea, pero el esquema de validación del `PATCH /api/admin/quotes/[id]` solo aceptaba una:

- **Array de ajustes del motor de reglas** (`{ ruleId, ruleName, kind, amount }[]`), generado por `resolveSuggestedPrice()` (`src/lib/quotes/pricing.ts`) al recalcular sugeridos desde el editor admin.
- **`{ composition: [...] }`**, un objeto con las piezas (`productId`/`size`/`color`) de un set armado en el **carrito corporativo público**, escrito por `POST /api/corporate/quotes` (`src/app/api/corporate/quotes/route.ts:165`) al crear el borrador desde una solicitud de cotización del cliente.

El `PatchSchema` en `src/app/api/admin/quotes/[id]/route.ts` (antes del fix) declaraba `pricingBreakdown: z.array(...)` — solo la primera forma. El `QuoteEditor` no transforma este campo, solo lo reenvía tal cual al guardar (`buildPatch()` → `items` completo). Para cualquier cotización que tenga al menos una línea creada desde el carrito público (forma `{ composition }`), el primer `PATCH` (disparado internamente por `handleFinalize()` vía `saveDraft(false)` antes de llamar a `/finalize`) fallaba con 400 **antes de llegar siquiera al endpoint de finalización** — que en sí mismo estaba correcto.

**Reproducido con datos reales**: la cotización `47a99368-df0a-4c24-a005-7b0a4c824f33` (mencionada en el reporte del usuario) tiene exactamente una línea con `setId` y `pricingBreakdown: { composition: [...] }`. Validar ese item contra el esquema anterior produce:
```
{ "path": ["pricingBreakdown"], "code": "invalid_type", "message": "Invalid input: expected array, received object" }
```

### Hallazgos secundarios

- **Log "Errores de validación en ProductForm"**: `ProductForm` solo se monta en `/admin/productos/[id]`, `/admin/productos/nuevo` y embebido en `SetForm.tsx` (drawer "Crear producto nuevo" del armador de sets). No se importa en ningún componente del flujo de cotizaciones (`QuoteEditor`, `QuoteLineEditor`, `/admin/cotizaciones/**`). **Es independiente** del bug reportado — probablemente residuo de otra pestaña/navegación previa del navegador capturada en la misma sesión de consola. No se modificó nada al respecto.
- **Warnings de Radix `DialogContent`**: dos `ResponsiveDialog` del flujo de cotizaciones se renderizaban sin `description`, lo que Radix reporta como advertencia de accesibilidad (`aria-describedby` ausente): el diálogo "Buscar set/producto" del catálogo (`QuoteLineEditor.tsx:180`) y el diálogo "Filtros" del listado (`cotizaciones/page.tsx:179`). Los `AlertDialog` del mismo flujo (confirmación de regenerar PDF, papelera) ya tenían `AlertDialogDescription` y no generaban el warning.

## Corrección aplicada

### 1. Causa raíz — esquema alineado al contrato real
- Nuevo `src/lib/quotes/validation.ts`: extrae `PatchQuoteSchema`/`QuoteItemSchema` de la route handler a un módulo puro (testeable sin `next/server` ni BD). `pricingBreakdown` ahora es `z.union([array de ajustes del motor, { composition: [...] }])`, documentando en el propio esquema por qué existen ambas formas.
- `src/lib/quotes/pricing.ts`: nuevo tipo `QuoteItemPricingBreakdown` (unión de las dos formas) como fuente de verdad del contrato, usado por `service.ts` en vez del array estricto anterior.
- `src/app/api/admin/quotes/[id]/route.ts`: usa `PatchQuoteSchema` del módulo compartido; el mensaje de error de validación pasa a español y `details` ahora es `{ path, message }[]` (antes exponía el objeto crudo de Zod).

### 2. Errores accionables en la UI
- `QuoteEditor.saveDraft()` ya no descarta el cuerpo de error del `PATCH`: lo lee, lo traduce con `formatPatchErrorMessage()`/`describePatchIssue()` (mapeo de campos a español, incluyendo `Línea N — <campo>` para errores dentro de `items`) y lo muestra en el toast real en vez de "Error al guardar la cotización" genérico. Como `handleFinalize()` llama a `saveDraft(false)` antes de `/finalize`, este fix también resuelve el mensaje que veía el usuario al intentar generar la definitiva.
- `/finalize` (`src/lib/quotes/finalize.ts`) ya devolvía mensajes específicos de incompletitud (`QuoteFinalizeError`) y el `QuoteEditor` ya los mostraba — no requería cambios, pero nunca se alcanzaba porque el `PATCH` previo fallaba primero.
- La validación de completitud de `finalizeQuote()` se extrajo a `checkQuoteCompleteness()` (`src/lib/quotes/completeness.ts`), módulo puro, para poder testearla sin mockear transacciones de Drizzle. El orden transaccional (completitud → `quoteNumber` atómico → PDF → subida a R2) no cambió.

### 3. Accesibilidad — warnings de Radix
- `QuoteLineEditor.tsx`: `description` en el diálogo de búsqueda de catálogo.
- `cotizaciones/page.tsx`: `description` en el diálogo de filtros.

## Alcance

Cambios confinados a `src/lib/quotes/**`, `src/app/api/admin/quotes/[id]/route.ts`, `src/components/admin/quotes/**` y `src/app/admin/(dashboard)/cotizaciones/page.tsx`. No se tocó `src/lib/rules-engine/`, el modelo de datos (no hizo falta migración — `pricingBreakdown` ya era una columna `jsonb` sin esquema fijo en Postgres) ni el sitio público.
