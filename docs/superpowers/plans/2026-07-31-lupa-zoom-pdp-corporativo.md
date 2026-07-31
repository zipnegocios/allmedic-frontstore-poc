# Lupa de magnificación en Gallery del PDP corporativo (sets) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una lupa de magnificación con controles +/- de zoom sobre la imagen central del `Gallery` en `SetDetailContent.tsx` (PDP corporativo de sets), como componente + hook reusables.

**Architecture:** Un hook `useMagnifier` (estado/gestos puros: activo, nivel de zoom, origen de la lente, handlers de mouse/touch) + un componente `MagnifierImage` (markup: ícono de lupa, lente, controles +/-, botón cerrar) que envuelve `MediaGridThumb` sin cambiar su comportamiento por defecto. Se integra en `Gallery` reemplazando el `MediaGridThumb` directo de la imagen central. La lente usa una URL transformada de alta resolución vía `cloudflareImageLoader` (el loader custom de `next/image` en este proyecto) posicionada con `background-image`/`background-position`, evitando pelear con el modo `fill` de `next/image`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, lucide-react (íconos), Cloudflare Images (transformación vía `src/lib/cloudflare-image-loader.ts`).

## Global Constraints

- `ZOOM_MIN = 1.5`, `ZOOM_MAX = 4`, `ZOOM_STEP = 0.5`, `ZOOM_DEFAULT = 2` (spec: `docs/superpowers/specs/2026-07-31-lupa-zoom-pdp-corporativo-design.md`).
- La lupa solo se activa para `item.type === 'image'`, item ya cargado (no placeholder de loading), y no es el fallback genérico sin imagen real.
- Cambiar de imagen enfocada (miniatura, color, bloque) debe desactivar automáticamente la lupa.
- No modificar `ImageGallery.tsx` ni ningún otro PDP en este plan — solo dejar el hook/componente listos para reuso futuro.
- No agregar tests de interacción automatizados (sin infraestructura Playwright/Cypress en el proyecto); validar con build/lint/typecheck + checklist manual.
- Nunca ejecutar `git commit`/`git push` — solo sugerir el mensaje al final (regla de `CLAUDE.md`).
- No usar Chrome DevTools MCP para ninguna validación.

---

### Task 1: Hook `useMagnifier`

**Files:**
- Create: `src/hooks/useMagnifier.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface MagnifierOrigin { x: number; y: number } // 0–1 relativo al contenedor

  export interface UseMagnifierResult {
    isActive: boolean;
    zoomLevel: number;
    origin: MagnifierOrigin;
    toggle: () => void;
    deactivate: () => void;
    setZoom: (level: number) => void;
    containerHandlers: {
      onClick: (e: React.MouseEvent) => void;
      onMouseMove: (e: React.MouseEvent) => void;
      onMouseLeave: () => void;
      onTouchStart: (e: React.TouchEvent) => void;
      onTouchMove: (e: React.TouchEvent) => void;
      onTouchEnd: () => void;
    };
  }

  export function useMagnifier(containerRef: React.RefObject<HTMLElement | null>): UseMagnifierResult;
  ```
- Consumes: nada de tareas anteriores (es la base).

- [ ] **Step 1: Escribir el hook**

```ts
'use client';

import { useCallback, useRef, useState } from 'react';

export const ZOOM_MIN = 1.5;
export const ZOOM_MAX = 4;
export const ZOOM_STEP = 0.5;
export const ZOOM_DEFAULT = 2;

export interface MagnifierOrigin {
  x: number;
  y: number;
}

export interface UseMagnifierResult {
  isActive: boolean;
  zoomLevel: number;
  origin: MagnifierOrigin;
  toggle: () => void;
  deactivate: () => void;
  setZoom: (level: number) => void;
  containerHandlers: {
    onClick: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseLeave: () => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
}

function clampZoom(level: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, level));
}

function relativeOrigin(clientX: number, clientY: number, rect: DOMRect): MagnifierOrigin {
  return {
    x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
  };
}

function touchDistance(touches: React.TouchList): number {
  const [a, b] = [touches[0], touches[1]];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/** Estado y gestos de una lupa de magnificación sobre un contenedor con ref propia —
 * sin conocimiento de qué se renderiza dentro (reusable por cualquier imagen). */
export function useMagnifier(containerRef: React.RefObject<HTMLElement | null>): UseMagnifierResult {
  const [isActive, setIsActive] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(ZOOM_DEFAULT);
  const [origin, setOrigin] = useState<MagnifierOrigin>({ x: 0.5, y: 0.5 });
  const pinchStartDistance = useRef<number | null>(null);
  const pinchStartZoom = useRef(ZOOM_DEFAULT);

  const deactivate = useCallback(() => {
    setIsActive(false);
  }, []);

  const toggle = useCallback(() => {
    setIsActive((prev) => {
      if (!prev) setZoomLevel(ZOOM_DEFAULT);
      return !prev;
    });
  }, []);

  const setZoom = useCallback((level: number) => {
    setZoomLevel(clampZoom(level));
  }, []);

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setOrigin(relativeOrigin(e.clientX, e.clientY, rect));
      toggle();
    },
    [containerRef, toggle]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setOrigin(relativeOrigin(e.clientX, e.clientY, rect));
    },
    [isActive, containerRef]
  );

  const onMouseLeave = useCallback(() => {
    deactivate();
  }, [deactivate]);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        pinchStartDistance.current = touchDistance(e.touches);
        pinchStartZoom.current = zoomLevel;
        return;
      }
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setOrigin(relativeOrigin(e.touches[0].clientX, e.touches[0].clientY, rect));
      toggle();
    },
    [containerRef, toggle, zoomLevel]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isActive || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (e.touches.length === 2 && pinchStartDistance.current !== null) {
        const currentDistance = touchDistance(e.touches);
        const ratio = currentDistance / pinchStartDistance.current;
        setZoomLevel(clampZoom(pinchStartZoom.current * ratio));
        return;
      }

      if (e.touches.length === 1) {
        setOrigin(relativeOrigin(e.touches[0].clientX, e.touches[0].clientY, rect));
      }
    },
    [isActive, containerRef]
  );

  const onTouchEnd = useCallback(() => {
    pinchStartDistance.current = null;
  }, []);

  return {
    isActive,
    zoomLevel,
    origin,
    toggle,
    deactivate,
    setZoom,
    containerHandlers: { onClick, onMouseMove, onMouseLeave, onTouchStart, onTouchMove, onTouchEnd },
  };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin nuevos errores relacionados a `src/hooks/useMagnifier.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMagnifier.ts
git commit -m "feat(pdp): agregar hook useMagnifier con estado y gestos de lupa"
```

---

### Task 2: Componente `MagnifierImage`

**Files:**
- Create: `src/components/media/MagnifierImage.tsx`
- Modify: (ninguno todavía — la integración es Task 3)

**Interfaces:**
- Consumes: `useMagnifier` de `src/hooks/useMagnifier.ts` (`ZOOM_MIN`, `ZOOM_MAX`, `ZOOM_STEP` exportados también); `MediaGridThumb` de `src/components/media/MediaGridThumb.tsx`; `MediaItem` de `@/lib/media`; `cloudflareImageLoader` de `@/lib/cloudflare-image-loader` (default export); `cn` de `@/lib/utils`.
- Produces:
  ```ts
  export interface MagnifierImageProps {
    item: MediaItem | undefined;
    fallback: string;
    alt: string;
    className?: string;
    onLoad?: () => void;
    onError?: () => void;
  }
  export function MagnifierImage(props: MagnifierImageProps): JSX.Element;
  ```

- [ ] **Step 1: Escribir el componente**

```tsx
'use client';

import { useRef, useState } from 'react';
import { Minus, Plus, X, ZoomIn } from 'lucide-react';
import { MediaGridThumb } from './MediaGridThumb';
import { useMagnifier, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '@/hooks/useMagnifier';
import cloudflareImageLoader from '@/lib/cloudflare-image-loader';
import { cn } from '@/lib/utils';
import type { MediaItem } from '@/lib/media';

const LENS_SOURCE_WIDTH = 1600;

export interface MagnifierImageProps {
  item: MediaItem | undefined;
  fallback: string;
  alt: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}

/** Envuelve MediaGridThumb agregando una lupa de magnificación activable por click/tap.
 * Sin cambios de comportamiento cuando el item es video, no cargó aún, o no hay imagen real —
 * en esos casos se comporta exactamente igual que MediaGridThumb solo. */
export function MagnifierImage({ item, fallback, alt, className, onLoad, onError }: MagnifierImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const magnifier = useMagnifier(containerRef);

  const isImage = item?.type === 'image';
  const isRealImage = isImage && item.url !== fallback;
  const canMagnify = isRealImage && isLoaded;

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoaded(false);
    onError?.();
  };

  const lensUrl = canMagnify ? cloudflareImageLoader({ src: item.url, width: LENS_SOURCE_WIDTH }) : undefined;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      {...(canMagnify ? magnifier.containerHandlers : {})}
    >
      <MediaGridThumb
        item={item}
        fallback={fallback}
        alt={alt}
        fit="contain"
        className={className}
        onLoad={handleLoad}
        onError={handleError}
      />

      {canMagnify && !magnifier.isActive && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            magnifier.toggle();
          }}
          className="absolute top-3 right-3 z-10 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
          aria-label="Activar lupa"
        >
          <ZoomIn className="w-4 h-4 text-[#111111]" strokeWidth={1.5} />
        </button>
      )}

      {canMagnify && magnifier.isActive && lensUrl && (
        <>
          <div
            className="absolute inset-0 z-20 cursor-zoom-out"
            style={{
              backgroundImage: `url(${lensUrl})`,
              backgroundSize: `${magnifier.zoomLevel * 100}%`,
              backgroundPosition: `${magnifier.origin.x * 100}% ${magnifier.origin.y * 100}%`,
              backgroundRepeat: 'no-repeat',
            }}
          />

          <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
            <button
              type="button"
              onClick={() => magnifier.setZoom(magnifier.zoomLevel - ZOOM_STEP)}
              disabled={magnifier.zoomLevel <= ZOOM_MIN}
              className="w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors disabled:opacity-30"
              aria-label="Disminuir zoom"
            >
              <Minus className="w-4 h-4 text-[#111111]" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => magnifier.setZoom(magnifier.zoomLevel + ZOOM_STEP)}
              disabled={magnifier.zoomLevel >= ZOOM_MAX}
              className="w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors disabled:opacity-30"
              aria-label="Aumentar zoom"
            >
              <Plus className="w-4 h-4 text-[#111111]" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={magnifier.deactivate}
              className="w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
              aria-label="Cerrar lupa"
            >
              <X className="w-4 h-4 text-[#111111]" strokeWidth={1.5} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos y lint**

Run: `npx tsc --noEmit -p tsconfig.json` y `npm run lint`
Expected: sin nuevos errores relacionados a `src/components/media/MagnifierImage.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/media/MagnifierImage.tsx
git commit -m "feat(pdp): agregar componente MagnifierImage con lente y controles de zoom"
```

---

### Task 3: Integrar `MagnifierImage` en el `Gallery` del PDP de sets

**Files:**
- Modify: `src/app/(store)/corporativo/s/[slug]/SetDetailContent.tsx:14` (import), `:773-781` (uso en `Gallery`)

**Interfaces:**
- Consumes: `MagnifierImage` de `src/components/media/MagnifierImage.tsx` (Task 2), props idénticas a las que `MediaGridThumb` ya recibía (`item`, `fallback`, `alt`, `className`, `onLoad`, `onError`).
- Produces: nada nuevo — mismo contrato externo de `Gallery`/`SetDetailContent`.

- [ ] **Step 1: Reemplazar el import de `MediaGridThumb` por `MagnifierImage` en el punto de uso de la imagen central**

En `src/app/(store)/corporativo/s/[slug]/SetDetailContent.tsx:14`, agregar el import junto al de `MediaGridThumb` (que sigue usándose en `GalleryRail`, no se quita):

```tsx
import { MediaGridThumb } from '@/components/media/MediaGridThumb';
import { MagnifierImage } from '@/components/media/MagnifierImage';
```

Luego, en el bloque de la imagen central (líneas ~773-781), reemplazar:

```tsx
          <MediaGridThumb
            item={focusedImage}
            fallback="/images/placeholder-product.jpg"
            alt={focus.side === 'A' ? pieceA.productName : pieceB.productName}
            fit="contain"
            className={cn('object-contain transition-opacity duration-200', isImageLoading && 'opacity-0')}
            onLoad={() => setIsImageLoading(false)}
            onError={() => setIsImageLoading(false)}
          />
```

por:

```tsx
          <MagnifierImage
            item={focusedImage}
            fallback="/images/placeholder-product.jpg"
            alt={focus.side === 'A' ? pieceA.productName : pieceB.productName}
            className={cn('object-contain transition-opacity duration-200', isImageLoading && 'opacity-0')}
            onLoad={() => setIsImageLoading(false)}
            onError={() => setIsImageLoading(false)}
          />
```

(Nota: `MagnifierImage` ya llama a `MediaGridThumb` internamente con `fit="contain"` fijo, por eso no se pasa esa prop aquí.)

- [ ] **Step 2: Verificar que la desactivación por cambio de imagen ocurre sola**

`MagnifierImage` mantiene su propio `containerRef` y estado del hook `useMagnifier` — al cambiar `focusedImage` (nueva `key` implícita por props, mismo componente montado), el `isLoaded` se resetea a `false` en cada remount solo si React desmonta/remonta. Como `Gallery` NO usa `key={trackedFocusedUrl}` sobre este nodo, `MagnifierImage` es el mismo componente montado entre cambios de imagen — para que la lupa se desactive al cambiar de foco (requisito de la spec), agregar un `key` explícito atado a la imagen enfocada, forzando remount limpio (mismo patrón ya usado para `video` con `key={activeItem.url}` en `ImageGallery.tsx:66`):

```tsx
          <MagnifierImage
            key={focusedImage?.url}
            item={focusedImage}
            fallback="/images/placeholder-product.jpg"
            alt={focus.side === 'A' ? pieceA.productName : pieceB.productName}
            className={cn('object-contain transition-opacity duration-200', isImageLoading && 'opacity-0')}
            onLoad={() => setIsImageLoading(false)}
            onError={() => setIsImageLoading(false)}
          />
```

Esto es más simple y confiable que exponer un `deactivate()` imperativo hacia el padre: remount limpio = estado de lupa fresco (`isActive: false`) en cada cambio de imagen, miniatura, color o bloque.

- [ ] **Step 3: Verificar build, lint y typecheck**

Run:
```bash
npm run build
npm run lint
npx tsc --noEmit -p tsconfig.json
```
Expected: los tres sin errores nuevos relacionados a estos archivos.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(store)/corporativo/s/[slug]/SetDetailContent.tsx"
git commit -m "feat(pdp): activar lupa de magnificacion en imagen central del Gallery de sets"
```

---

## Self-Review (completado antes de entregar el plan)

**Cobertura de la spec:**
- Activación click/tap toggle → Task 1 (`toggle`) + Task 2 (`onClick`, ícono `ZoomIn`). ✅
- Lente flotante sobre la misma imagen → Task 2 (`div` con `backgroundImage`/`backgroundPosition`). ✅
- Controles +/- flotantes → Task 2 (`Minus`/`Plus` botones con `setZoom`). ✅
- Pinch-to-zoom + arrastre en touch → Task 1 (`onTouchStart`/`onTouchMove` con `pinchStartDistance`). ✅
- Deshabilitado para video/loading/placeholder → Task 2 (`canMagnify`). ✅
- Desactivación automática al cambiar imagen/color/bloque → Task 3 Step 2 (`key={focusedImage?.url}`). ✅
- Reusable para `ImageGallery.tsx` futuro → hook y componente son independientes de `SetDetailContent`, sin imports cruzados. ✅
- No modificar `ImageGallery.tsx` ni otros PDP → confirmado, solo se toca `SetDetailContent.tsx`. ✅

**Placeholders:** ninguno — todo el código de cada step es completo y ejecutable.

**Consistencia de tipos:** `UseMagnifierResult` (Task 1) se consume en Task 2 exactamente con los mismos nombres (`isActive`, `zoomLevel`, `origin`, `toggle`, `deactivate`, `setZoom`, `containerHandlers`). `MagnifierImageProps` (Task 2) se usa en Task 3 con las mismas props (`item`, `fallback`, `alt`, `className`, `onLoad`, `onError`) que ya recibía `MediaGridThumb` en el sitio de integración, sin romper el contrato existente de `Gallery`.

## Validación final (según CLAUDE.md)

- Build: ejecutar `npm run build` y reportar resultado.
- Lint: ejecutar `npm run lint` y reportar resultado.
- Typecheck: ejecutar `npx tsc --noEmit -p tsconfig.json` y reportar resultado.
- Tests: no aplica (sin infraestructura de tests de interacción); confirmar que la suite existente (si la hay) sigue en verde.
- Checklist de verificación manual en producción: incluir en la respuesta final (desktop mouse, touch pinch/pan, edge cases video/placeholder/cambio de imagen).
- No ejecutar `git commit`/`git push` — solo sugerir mensajes al final de cada tarea (ya incluidos arriba) y un mensaje consolidado final.
