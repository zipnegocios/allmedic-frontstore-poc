# Instrucciones Globales de Ejecución para Claude Code

Estas reglas son obligatorias y aplican a **todos los planes, implementaciones, refactorizaciones, correcciones, auditorías y prompts de modificación**, salvo que el usuario indique explícitamente lo contrario.

## Flujo de trabajo

* Antes de realizar cambios, analizar el impacto en la arquitectura, la base de datos, las dependencias y los módulos relacionados.
* Priorizar soluciones consistentes con la arquitectura existente.
* Evitar introducir deuda técnica o duplicación de código.
* Mantener compatibilidad con el resto del sistema.

---

# Git

## Prohibido

Nunca ejecutar automáticamente:

* `git commit`
* `git push`
* creación de Pull Requests
* creación de Releases

El repositorio debe quedar únicamente con los cambios realizados en el working tree.

## Obligatorio

Al finalizar el trabajo, sugerir un mensajes para el commit siguiendo Conventional Commits.

Ejemplos:

```bash
git commit -m "fix: conectar regla PRICE_VISIBILITY al catalogo individual mediante PriceVisibilityContext para ocultar precios globalmente"

```

No ejecutar esos comandos. Solo sugerirlos.

---

# Base de Datos

Cuando una tarea implique modificaciones en la base de datos:

* generar las migraciones necesarias mediante Drizzle ORM.
* ejecutar únicamente los scripts de Drizzle ORM necesarios.
* nunca realizar modificaciones manuales a la base de datos.
* mantener sincronizado el esquema con las migraciones.

Si el cambio requiere datos iniciales o ajustes estructurales:

* actualizar los seeds correspondientes.
* ejecutar también los seeds necesarios para dejar el entorno de producción consistente.

No omitir migraciones ni seeds cuando sean requeridos.

---

# Validación

No utilizar pruebas manuales como mecanismo principal de validación.

La validación debe realizarse mediante:

* build del proyecto
* lint
* typecheck
* tests existentes
* validaciones automáticas disponibles

Siempre ejecutar las verificaciones que correspondan antes de finalizar el trabajo.

---

# Chrome DevTools MCP

Está completamente prohibido utilizar:

* MCP Chrome DevTools

Nunca debe emplearse para inspección, pruebas o automatización.

---

# Entregables

No crear archivos Markdown de resumen.

No generar:

* SUMMARY.md
* REPORT.md
* IMPLEMENTATION.md
* CHANGELOG temporal
* cualquier otro documento de cierre

Toda la información final debe entregarse directamente en el chat.

---

# Respuesta Final Obligatoria

Al finalizar cualquier tarea, responder únicamente en el chat con los siguientes apartados:

## Resumen Ejecutivo

Incluir:

* objetivo realizado
* componentes modificados
* archivos relevantes
* cambios en la arquitectura (si existen)
* cambios en la base de datos (si existen)
* riesgos detectados
* observaciones importantes

---

## Verificación Manual en Producción

Incluir un checklist claro para validar:

* funcionamiento esperado
* casos principales
* casos límite
* validación visual
* validación funcional
* validación de permisos
* validación de base de datos (si aplica)

---

## Migraciones Ejecutadas

Cuando corresponda indicar:

* migraciones creadas
* migraciones ejecutadas
* seeds ejecutados

---

## Builds y Validaciones

Indicar los comandos ejecutados y su resultado.

Ejemplo:

* Build: ✅
* Lint: ✅
* Typecheck: ✅
* Tests: ✅

---


Estas reglas tienen prioridad sobre el flujo normal de trabajo y deben respetarse en todas las tareas futuras, planes de implementación, auditorías, refactorizaciones y solicitudes de modificación.
