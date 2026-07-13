# PLAN — Módulo de Cotizaciones Pro (`/admin/cotizaciones`)

> Ubicación sugerida en el repo: `docs/superpowers/plans/2026-07-13-cotizaciones-pro.md`

## Objetivo

Convertir el módulo de cotizaciones en la herramienta central de venta asistida de Allmedic: cotizaciones para pedidos **corporativos e individuales**, 100% editables por el vendedor, con precios sugeridos calculados por el motor de reglas, sistema flexible de impuestos y vigencias con presets, snapshot editable de datos del cliente, generación y almacenamiento de PDF con membrete de la empresa, creación manual sin solicitud web previa, e integración bidireccional con `/admin/prospectos`.

---

## Reglas globales de ejecución (obligatorias)

1. **Git:** NUNCA ejecutar `git commit`, `git push`, crear PRs ni releases. El working tree queda con los cambios. Al final, solo **sugerir** mensajes de commit con Conventional Commits (`feat:`, `fix:`, `docs:`).
2. **Base de datos:** todo cambio vía migraciones de Drizzle ORM. Nunca modificaciones manuales. Ejecutar los scripts de Drizzle necesarios y mantener el esquema sincronizado. Actualizar y ejecutar seeds cuando el cambio los requiera.
3. **Validación:** nada de pruebas manuales como mecanismo principal. Validar con `npm run build`, lint, typecheck y los tests existentes (Vitest). Ejecutar todas las verificaciones antes de finalizar.
4. **Prohibido MCP Chrome DevTools** para cualquier propósito.
5. **Entregables:** NO crear archivos Markdown de resumen (SUMMARY.md, REPORT.md, IMPLEMENTATION.md, changelogs temporales). Toda la información final va directo al chat con el formato de Respuesta Final Obligatoria (Resumen Ejecutivo, Verificación Manual en Producción, Migraciones Ejecutadas, Builds y Validaciones, Commits Sugeridos).
6. **Arquitectura:** el motor de reglas (`src/lib/rules-engine/`) permanece **puro, sin dependencias de DB**. Los servicios de cotización lo consumen siguiendo el patrón ya existente del carrito corporativo (`PROMO` en `pricing.ts`).
7. **Idioma:** todo el copy de UI, comentarios y documentación en español (Ecuador). Identificadores de código, rutas API y esquema de BD en inglés.
8. **Principio "sin opción muerta":** toda opción seleccionable en el panel debe funcionar o estar explícitamente bloqueada con explicación.
9. **Documentación con rigor técnico:** describir qué hace cada funcionalidad, nunca cuándo se construyó. Prohibido "próximamente", "planificado" o referencias a fases/sesiones.
10. Antes de cambiar cualquier archivo, analizar impacto en arquitectura, BD, dependencias y módulos relacionados. Priorizar consistencia con patrones existentes. No introducir duplicación.

---

## Decisiones de producto (confirmadas por Gustavo — NO reabrir)

| # | Tema | Decisión |
|---|------|----------|
| 1 | Edición de definitiva enviada | **Sobreescribir y regenerar el PDF.** Sin versionado. El PDF almacenado siempre refleja el estado vigente. |
| 2 | Precios sugeridos | **Precio base por canal + motor de reglas con desglose visible.** Corporativo: precio mayorista por tier + precio de set calculado. Individual: precio retail de la variante. Sobre eso, ejecutar el motor (PROMO, VOLUME_SCALE, VOLUME_DISCOUNT_RETAIL, etc.) y mostrar el desglose. **Todo sobreescribible** por el vendedor. |
| 3 | Tipos de línea | **Ambos:** líneas de catálogo (producto/variante/set con talla, color, cantidad sin límites) **y líneas libres** (descripción + cantidad + precio unitario manuales, sin vínculo a catálogo). Botón explícito "Agregar línea libre" junto al selector de catálogo. |
| 4 | Datos del cliente | **Snapshot en la cotización + checkbox "Actualizar también la ficha del cliente".** Por defecto solo edita el snapshot; el checkbox propaga a la cuenta corporativa o prospecto. |
| 5 | Impuestos | **Sistema flexible con presets.** Presets de impuestos administrables (ej. "IVA 15%", "IVA 0%", "Exento"). Por cotización el administrador decide si los precios **incluyen** el impuesto (desglose hacia atrás) o si **se suma** al final, y el porcentaje. Override de tarifa **por línea**. Siempre editable. |
| 6 | Prospecto → cotización | Al crear cotización desde un prospecto: estado del prospecto pasa a **"Cotizado"** + **enlace bidireccional**. Un prospecto puede generar **varias** cotizaciones. |
| 7 | Entrega al cliente | **Los tres canales coexisten**, disparados por el administrador de forma independiente: descarga manual del PDF (siempre disponible), "Enviar por correo" (PDF adjunto, registra fecha), "Publicar en portal del cliente". |
| 8 | Canal individual | Las solicitudes individuales **ya existen** (pedido registrado + conversación por WhatsApp). No se toca el sitio público. El admin construye la cotización a partir de ese registro. Fase 0 audita dónde viven esos registros. |
| 9 | Vigencia | **Presets de vencimiento administrables** (ej. 7/15/30 días) + override por cotización, siempre flexible. Badge "Vencida" **calculado al consultar** (sin cron ni cambio forzado de estado). El vendedor puede extender la vigencia. |
| 10 | Creación manual | Se pueden crear cotizaciones **desde cero** sin solicitud web: selector de cliente existente (cuenta corporativa o prospecto) **o** captura inline de un cliente nuevo. |

### Decisiones técnicas resueltas (aplicar salvo que la Fase 0 demuestre incompatibilidad)

- **Estados:** `BORRADOR` → `DEFINITIVA` (asigna número oficial y genera PDF) → resultado manual `ACEPTADA` / `RECHAZADA`. "Enviada por correo" y "Publicada en portal" son **marcas de entrega** (timestamps `sentByEmailAt`, `publishedToPortalAt`), no estados excluyentes. "Vencida" es un estado **derivado** (fecha de vencimiento < hoy y sin resultado), mostrado como badge.
- **Numeración:** secuencial por año, formato `COT-YYYY-NNNNN`, asignada **solo al pasar a DEFINITIVA** (los borradores usan su id interno). Generación atómica (secuencia o transacción con lock) para evitar duplicados.
- **PDF:** generación server-side. Primera opción `@react-pdf/renderer`; la Fase 0 verifica compatibilidad con React 19 / Next 16 en el entorno actual. Fallback: `pdfmake` o `pdf-lib`. **Prohibido** cualquier solución basada en navegador/Chrome headless.
- **Almacenamiento del PDF:** bucket R2 **dedicado y separado de la Media Library**, ya creado y configurado:
  - Bucket: `cotizaciones` (ubicación WNAM, creado Jul 13, 2026)
  - Endpoint S3: `https://9c4291b3ee0d4e5d5e972c164527f70e.r2.cloudflarestorage.com/cotizaciones`
  - Dominio personalizado: `cotizaciones.allmedicuniforms.com`
  - CORS ya aplicado: orígenes `https://frontstore.allmedicuniforms.com`, `https://allmedicuniforms.com`, `https://www.allmedicuniforms.com`, `http://localhost:3000`; métodos `GET`, `PUT`, `HEAD`; headers `Content-Type`, `Content-Length`; max-age 3600.

  Implementación: nuevas variables de entorno `R2_QUOTES_BUCKET=cotizaciones` y `R2_QUOTES_PUBLIC_URL=https://cotizaciones.allmedicuniforms.com` (agregarlas a `.env.example` y documentar que deben cargarse en EasyPanel). Reutilizar el **cliente S3/R2 existente** parametrizando el bucket — no duplicar código de conexión; extraer una factoría/config si el cliente actual tiene el bucket hardcodeado. La Fase 0 verifica si las credenciales actuales (`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`) tienen alcance sobre el nuevo bucket o si se requieren credenciales propias (`R2_QUOTES_ACCESS_KEY_ID`/`R2_QUOTES_SECRET_ACCESS_KEY`).

  **Privacidad de las claves:** el dominio personalizado hace los objetos públicamente accesibles por URL, y los números de cotización son secuenciales (adivinables). Por eso la clave del objeto DEBE incluir un token aleatorio no adivinable: `2026/COT-2026-00042-{token}.pdf` (token nanoid ≥ 21 caracteres, persistido en `quotes.pdfKey`). Al sobreescribir una definitiva, regenerar el PDF y reemplazar el objeto en R2 usando la **misma clave** (el enlace ya compartido sigue mostrando la versión vigente). Los PDFs **no** aparecen en la Biblioteca de medios: son documentos, no medios.
- **Membrete y pie de página:** nueva sección "Datos de empresa" en `/admin/configuracion`: logo (seleccionado desde la Biblioteca), razón social, RUC, dirección, teléfonos, email, sitio web y nota de pie opcional. El PDF los consume de ahí. Nada hardcodeado.
- **Totales:** subtotal → descuento global opcional (% o monto fijo, adicional a descuentos por línea) → subtotal neto → impuestos según configuración → **total**. Redondeo a 2 decimales con estrategia consistente (documentarla).
- **Snapshot de precios:** cada línea guarda `suggestedUnitPrice` (lo que calculó el sistema) y `unitPrice` (lo que fijó el vendedor), más el desglose del motor en un campo JSON para auditoría. La cotización nunca recalcula precios ya fijados salvo acción explícita "Recalcular sugeridos".

---

## FASE 0 — Auditoría obligatoria (sin tocar código)

Producir una matriz verificada del estado actual **antes de cualquier cambio**. Inspeccionar y reportar:

1. **Esquema actual:** tablas de cotizaciones existentes (`quotes`, `quote_items` o equivalentes), campos, relaciones con cuentas corporativas y prospectos/leads. Enumerar qué falta contra el modelo objetivo.
2. **UI actual de `/admin/cotizaciones`:** páginas, componentes, qué es editable hoy, qué estados maneja.
3. **`/admin/prospectos`:** estructura de leads corporativos, dónde y cómo se registran las **solicitudes individuales** (¿misma tabla, tabla propia, campo de tipo?), estados actuales del prospecto.
4. **Motor de reglas:** puntos de consumo actuales en pricing corporativo (`pricing.ts`, patrón PROMO), qué función pura se puede reutilizar para calcular sugeridos de una cotización.
5. **Infraestructura de correo:** proveedor/servicio transaccional existente de Fase 4, plantillas actuales, capacidad de adjuntar archivos.
6. **Portal del cliente:** qué muestra hoy de cotizaciones y qué falta para "publicar".
7. **Servicios R2:** cliente existente y patrón de subida de la Media Library; determinar si el cliente admite múltiples buckets o tiene el bucket hardcodeado (en ese caso, planificar la extracción a factoría/config). Verificar si las credenciales R2 actuales tienen alcance sobre el bucket `cotizaciones` o si se necesitan credenciales dedicadas. Confirmar las variables de entorno nuevas requeridas (`R2_QUOTES_BUCKET`, `R2_QUOTES_PUBLIC_URL` y, de ser necesario, credenciales propias).
8. **Librería PDF:** verificar compatibilidad de `@react-pdf/renderer` con React 19/Next 16 en este repo (instalación de prueba + render mínimo en un script). Decidir y justificar la librería.
9. **`/admin/configuracion`:** patrón actual de settings (tabla, servicios, UI) para insertar "Datos de empresa", presets de impuestos y presets de vigencia de forma consistente.

Entregar la matriz en el chat. Si algún hallazgo contradice una decisión técnica de este plan, **detenerse y reportar** antes de continuar.

---

## FASE 1 — Esquema y migraciones

Ajustar/crear con Drizzle (nombres finales según convenciones halladas en Fase 0):

- **`quotes`:** id, `quoteNumber` (nullable hasta DEFINITIVA, único), `status` (`DRAFT` | `FINAL`), `outcome` (`ACCEPTED` | `REJECTED` | null), `channel` (`CORPORATE` | `RETAIL`), snapshot de cliente (razón social/nombre, identificación RUC/cédula, contacto, email, teléfono, dirección — campos JSON o columnas según patrón del repo), FK opcional a cuenta corporativa y a prospecto, configuración de impuesto de la cotización (presetId opcional, `taxRate`, `pricesIncludeTax`), descuento global (`type` %/fijo, `value`), `validityDays`, `expiresAt`, `notes`, `pdfKey` (R2), `pdfGeneratedAt`, `sentByEmailAt`, `publishedToPortalAt`, timestamps, autor.
- **`quote_items`:** id, quoteId, `kind` (`CATALOG` | `FREE`), FKs opcionales (productId, variantId, setId), atributos (talla, color), `description` (obligatoria en FREE, autogenerada en CATALOG), `quantity`, `suggestedUnitPrice`, `unitPrice`, `discount` por línea opcional, `taxRateOverride` opcional, `pricingBreakdown` JSON (desglose del motor), `sortOrder`.
- **`tax_presets`:** id, nombre, tasa, `pricesIncludeTax` default, activo, orden.
- **`validity_presets`:** id, nombre, días, activo, orden.
- **Settings "Datos de empresa":** según el patrón de configuración existente (clave-valor o tabla dedicada): logoMediaId/URL, razón social, RUC, dirección, teléfonos, email, web, nota de pie.
- **Prospectos:** agregar estado "Cotizado" al enum/flujo si no existe, y la relación 1:N prospecto → cotizaciones.

Generar migraciones, ejecutarlas, y **seeds**: presets de impuestos iniciales ("IVA 15%" incluido/sumado según definición, "IVA 0%", "Exento") y presets de vigencia (7, 15, 30 días). Mantener seeds idempotentes.

---

## FASE 2 — Servicios y API

1. **Servicio de precios sugeridos** (`src/lib/quotes/pricing.ts` o ubicación consistente): dada la composición de la cotización y el canal, resolver precio base (tier mayorista/set para corporativo, retail para individual) y ejecutar el **motor de reglas puro** con el contexto adecuado (mismo patrón de scope resolution que PROMO). Devuelve por línea: base, ajustes con detalle, sugerido final. El motor NO se modifica ni gana dependencias.
2. **Cálculo de totales:** función pura y testeada (Vitest) que recibe líneas + config de impuestos + descuento global y devuelve subtotal, descuentos, base imponible por tarifa, impuestos, total. Cubrir ambos modos (precios con impuesto incluido / impuesto sumado) y overrides por línea.
3. **CRUD de cotizaciones:** crear (desde cero con cliente existente o inline; desde prospecto pre-cargando ítems, sugeridos y snapshot), leer, actualizar (líneas, cliente snapshot ± propagación a ficha vía checkbox, impuestos, descuentos, vigencia, notas), eliminar borradores (definitivas solo anular vía `outcome`).
4. **Transición a DEFINITIVA:** validación de completitud, asignación atómica de `quoteNumber`, generación y subida del PDF, todo transaccional. Editar una DEFINITIVA regenera el PDF sobre la misma clave R2.
5. **Acciones de entrega:** endpoint de envío por correo (adjunta PDF, registra `sentByEmailAt`), endpoint de publicación en portal (`publishedToPortalAt`), y URL de descarga (firmada o pública según patrón R2 existente).
6. **Permisos:** todas las rutas bajo la protección admin existente; verificación en server, no solo UI.

---

## FASE 3 — Editor de cotizaciones (UI)

Reconstruir/ampliar `/admin/cotizaciones` con shadcn/ui:

1. **Listado:** tabla con número (o "Borrador"), cliente, canal, total, estado + badge derivado "Vencida", marcas de entrega (correo/portal), fecha; filtros por estado, canal y búsqueda.
2. **Editor (crear/editar):**
   - Cabecera de cliente: snapshot editable + checkbox "Actualizar también la ficha del cliente"; selector de cliente existente o alta inline al crear desde cero.
   - Líneas: buscador de catálogo (productos con variante/talla/color, sets con su composición) y botón **"Agregar línea libre"**. Cantidad, talla, color, precio editables inline sin límites. Reordenamiento. Al agregar/editar una línea de catálogo, mostrar el **sugerido con desglose** (popover/acordeón con los ajustes del motor) y permitir sobreescribir; indicador visual cuando `unitPrice ≠ suggestedUnitPrice`. Botón "Recalcular sugeridos" explícito.
   - Panel de totales: descuento global, selector de preset de impuesto + toggle "precios incluyen impuesto" + tasa editable, override de tarifa por línea, totales en vivo.
   - Vigencia: selector de preset + días editables, fecha de vencimiento visible, acción "Extender vigencia".
   - Acciones según estado: guardar borrador, **"Generar cotización definitiva"**, descargar PDF, enviar por correo, publicar en portal, marcar Aceptada/Rechazada. Editar una definitiva muestra aviso "al guardar se regenerará el PDF".
3. **Configuración:** en `/admin/configuracion`, secciones para Datos de empresa (logo desde Biblioteca + campos), presets de impuestos y presets de vigencia (CRUD completo, sin opciones muertas).
4. Copy 100% en español (Ecuador), estados vacíos y errores cuidados.

---

## FASE 4 — PDF

1. Plantilla profesional con **membrete** (logo + datos de empresa en cabecera) y **pie de página** con datos de Allmedic desde configuración; número, fechas de emisión y vencimiento, datos del cliente (snapshot), tabla de líneas (descripción, talla/color cuando aplique, cantidad, precio unitario, descuento, importe), totales con desglose de impuestos según configuración, notas y nota de pie.
2. Generación server-side con la librería validada en Fase 0; subida al bucket dedicado `cotizaciones` con clave `YYYY/NUMERO-{token}.pdf` (token no adivinable); URL pública servida vía `https://cotizaciones.allmedicuniforms.com/{clave}`; regeneración sobre la misma clave al editar una definitiva.
3. Paginación correcta con muchas líneas; probar con cotización de 40+ líneas mixtas (catálogo + libres).

---

## FASE 5 — Integraciones

1. **Prospectos → Cotizaciones:** botón "Crear cotización" en el detalle del prospecto (corporativo e individual) que genera un **borrador** pre-cargado (ítems solicitados con talla/color/cantidad, sugeridos calculados, snapshot del cliente). El prospecto pasa a **"Cotizado"** con enlace a la cotización; el detalle del prospecto lista **todas** sus cotizaciones y cada cotización enlaza de vuelta a su prospecto.
2. **Correo:** plantilla transaccional en español con el PDF adjunto, usando la infraestructura existente; registrar envío.
3. **Portal del cliente:** al publicar, la cuenta corporativa vinculada ve la cotización con su PDF y estado en su portal. Si el cliente no tiene cuenta aprobada, la acción se deshabilita con explicación (sin opción muerta).

---

## FASE 6 — Validación, documentación y cierre

1. **Tests (Vitest):** cálculo de totales (ambos modos de impuesto, overrides por línea, descuento global % y fijo, redondeos), servicio de sugeridos (mock del contexto, verificación de que el motor permanece puro), transición a DEFINITIVA (numeración única), líneas libres vs catálogo.
2. `npm run build`, lint y typecheck limpios. Suite completa de tests existente en verde.
3. **Documentación:** actualizar `AGENTS.md` y docs del panel con el funcionamiento del módulo (rigor técnico, sin referencias temporales). Aprovechar para corregir la inconsistencia conocida de `AGENTS.md` si sigue mencionando Prisma + MySQL (el stack real es Drizzle + PostgreSQL).
4. **Verificación por API:** ciclo `curl` documentado en el chat: crear borrador desde cero → agregar línea de catálogo y línea libre → verificar sugeridos con desglose → cambiar impuesto y validar totales → pasar a definitiva → confirmar número y PDF en R2 → editar y confirmar regeneración → crear cotización desde un prospecto y verificar estado "Cotizado" + enlaces.
5. **Respuesta final en el chat** con el formato obligatorio: Resumen Ejecutivo, Verificación Manual en Producción (checklist funcional, visual, permisos, BD, casos límite), Migraciones Ejecutadas, Builds y Validaciones, Commits Sugeridos (Conventional Commits, sin ejecutar).

---

## Fuera de alcance (no tocar)

- Sitio público retail y corporativo (las solicitudes ya existen).
- Pagos en línea, conversión de cotización a pedido/factura, facturación electrónica SRI.
- Versionado histórico de cotizaciones (decisión explícita: sobreescritura).
- Motor de reglas: cero cambios en `src/lib/rules-engine/`.
