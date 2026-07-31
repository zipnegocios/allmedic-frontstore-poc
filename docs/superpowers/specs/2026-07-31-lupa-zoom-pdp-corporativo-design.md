# Lupa de magnificación en Gallery del PDP corporativo (sets)

## Contexto

El PDP corporativo de sets (`src/app/(store)/corporativo/s/[slug]/SetDetailContent.tsx`) renderiza un `Gallery` con dos piezas (bloque A y bloque B), cada una con su propio carril vertical de miniaturas (`GalleryRail`), y una imagen central compartida (`aspect-product`, línea ~767) que muestra el item enfocado (`focusedImage`) vía `MediaGridThumb`.

Se requiere agregar una lupa de magnificación sobre esa imagen central para que el cliente corporativo pueda inspeccionar detalles del producto, con controles para aumentar/disminuir el nivel de zoom.

## Objetivo

Implementar un componente reusable de lupa (`MagnifierImage`) insertado en el contenedor `aspect-product` del `Gallery`, con:

- Activación por click/tap (toggle).
- Lente flotante sobre la misma imagen (sin modal ni panel aparte).
- Controles +/- flotantes para variar el nivel de zoom.
- Soporte pinch-to-zoom y arrastre en touch.

Diseñado como componente + hook independientes para que pueda reusarse luego en `src/components/product/ImageGallery.tsx` u otros PDP, sin trabajo adicional de refactor.

## Arquitectura

### `useMagnifier` (hook)

Ubicación: `src/hooks/useMagnifier.ts`.

Encapsula estado y gestos, independiente de markup:

- `isActive: boolean` — si la lupa está activada.
- `zoomLevel: number` — nivel actual de magnificación (rango fijo, ver Constantes).
- `origin: { x: number; y: number }` — posición relativa (0–1) de la lente sobre la imagen.
- `toggle()` — activa/desactiva.
- `deactivate()` — fuerza desactivación (usado al cambiar de imagen/color).
- `setZoom(level: number)` — fija nivel de zoom (usado por botones +/-), clamped al rango permitido.
- `handlers` — objeto con los event handlers a spread sobre el contenedor: `onClick`/`onTouchStart` (toggle), `onMouseMove` (actualiza `origin` en desktop), `onTouchMove` (pan de un dedo + pinch de dos dedos), `onTouchEnd`.

El hook no sabe nada de `MediaItem` ni de la UI — solo produce estado y handlers genéricos sobre un elemento con dimensiones.

### `MagnifierImage` (componente)

Ubicación: `src/components/media/MagnifierImage.tsx`.

Props:

```ts
interface MagnifierImageProps {
  item: MediaItem | undefined;
  fallback: string;
  alt: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}
```

Responsabilidades:

- Renderiza `MediaGridThumb` igual que hoy para la vista normal (mismo `fit="contain"`, mismas props pasadas).
- Si `item?.type === 'video'`, o el item no cargó aún, o es el placeholder de fallback (sin imagen real) → no muestra el ícono de lupa ni activa el hook; se comporta exactamente como `MediaGridThumb` hoy.
- Si es una imagen real y cargada, muestra un ícono `ZoomIn` (lucide) en una esquina (ej. `top-3 right-3`, botón circular semi-transparente, mismo lenguaje visual que los controles existentes del PDP: `bg-white/90 backdrop-blur-sm rounded-full shadow-md`).
- Al activarse (`isActive`), renderiza sobre la imagen:
  - La "lente": la misma imagen pero escalada a `zoomLevel`×, recortada con `overflow-hidden` y posicionada según `origin` (técnica `background-image` + `background-size` + `background-position`, o `<img>` con `transform: scale()` + `transform-origin` dinámico — decidir en el plan de implementación cuál es más performante con Next/Image).
  - Controles **+ / -** flotantes (esquina opuesta al ícono de lupa, o inferior), que llaman a `setZoom(zoomLevel + STEP)` / `setZoom(zoomLevel - STEP)`.
  - Botón de cerrar (ícono `X`) que llama a `deactivate()`.
- En touch: `onTouchMove` con dos dedos ajusta `zoomLevel` proporcional a la distancia entre dedos (pinch); con un dedo, actualiza `origin` (pan).

### Integración en `SetDetailContent.tsx`

En `Gallery` (línea ~773), reemplazar el `MediaGridThumb` directo por `MagnifierImage`, pasando las mismas props (`item={focusedImage}`, `fallback`, `alt`, `className`, `onLoad`, `onError`). El contenedor `aspect-product` (línea 767) no cambia de tamaño ni posición — `MagnifierImage` ocupa el mismo espacio vía `absolute inset-0` interno igual que hace `MediaGridThumb` hoy.

Se agrega una llamada a `deactivate()` (expuesta por el hook, vía ref o callback) cuando cambia `focus` (nuevo `side`/`index`) o `trackedFocusedUrl` — mismo punto donde hoy se resetea `isImageLoading`.

## Constantes de zoom

- `ZOOM_MIN = 1.5`
- `ZOOM_MAX = 4`
- `ZOOM_STEP = 0.5`
- `ZOOM_DEFAULT = 2` (nivel al activar por click/tap, antes de usar +/- o pinch)

## Edge cases

- Item enfocado es video → sin ícono de lupa, sin cambios de comportamiento.
- Imagen aún cargando (`isImageLoading` en `Gallery`) → sin ícono de lupa hasta `onLoad`.
- Sin imagen real (fallback/placeholder genérico) → lupa deshabilitada.
- Cambiar de miniatura (rail A/B), cambiar de color, o cambiar de bloque → desactiva la lupa automáticamente.
- Zoom respeta límites `ZOOM_MIN`/`ZOOM_MAX`; los botones +/- se deshabilitan visualmente (opacity reducida) al llegar al límite.

## Fuera de alcance

- No se modifica `ImageGallery.tsx` ni ningún otro PDP en esta tarea — solo se deja el hook/componente listos para reuso futuro.
- No se agregan tests automatizados de interacción (no hay infraestructura Playwright/Cypress en el proyecto para esto); validación vía build/lint/typecheck + checklist manual.
- No hay cambios de base de datos ni de arquitectura de datos — es puramente UI/interacción sobre datos ya cargados.

## Validación

- `npm run build`
- `npm run lint`
- `tsc --noEmit` (o el script de typecheck del proyecto)
- Checklist manual de verificación en producción (funcionamiento en desktop con mouse, en touch con tap+pinch, edge cases de video/placeholder/cambio de imagen).
