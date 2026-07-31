'use client';

import { useCallback, useRef, useState, type MouseEvent, type RefObject, type TouchEvent } from 'react';

export const LENS_ZOOM_MIN = 1.5;
export const LENS_ZOOM_MAX = 4;
export const LENS_ZOOM_STEP = 0.5;
export const LENS_ZOOM_DEFAULT = 2;

/** Delay antes de activar la lente en touch — evita que un tap/scroll normal sobre la imagen
 * dispare la lente por accidente; si el dedo se mueve más de TOUCH_MOVE_CANCEL_PX antes de que
 * venza, se cancela y se deja pasar como gesto normal (scroll). */
const TOUCH_HOLD_MS = 180;
const TOUCH_MOVE_CANCEL_PX = 10;

export interface LensOrigin {
  x: number;
  y: number;
}

export interface UseMagnifierLensResult {
  isActive: boolean;
  zoomLevel: number;
  origin: LensOrigin;
  setZoom: (level: number) => void;
  imageHandlers: {
    onMouseEnter: (e: MouseEvent) => void;
    onMouseMove: (e: MouseEvent) => void;
    onMouseLeave: () => void;
    onTouchStart: (e: TouchEvent) => void;
    onTouchMove: (e: TouchEvent) => void;
    onTouchEnd: () => void;
    onTouchCancel: () => void;
  };
}

function clampZoom(level: number): number {
  return Math.min(LENS_ZOOM_MAX, Math.max(LENS_ZOOM_MIN, level));
}

function relativeOrigin(clientX: number, clientY: number, rect: DOMRect): LensOrigin {
  return {
    x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
  };
}

/** Estado y gestos de la lente circular sobre un contenedor de imagen con ref propia — agnóstico
 * de UI (sin JSX, sin conocimiento de MediaItem/Cloudflare). En desktop `isActive` es 100%
 * derivado de hover (mouseenter/mousemove activan, mouseleave desactiva); en touch requiere
 * mantener presionado (press-and-hold) para no interferir con el tap/scroll normal de los
 * carriles de miniaturas — ver TOUCH_HOLD_MS/TOUCH_MOVE_CANCEL_PX. */
export function useMagnifierLens(imageRef: RefObject<HTMLElement | null>): UseMagnifierLensResult {
  const [isActive, setIsActive] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(LENS_ZOOM_DEFAULT);
  const [origin, setOrigin] = useState<LensOrigin>({ x: 0.5, y: 0.5 });
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPoint = useRef<{ x: number; y: number } | null>(null);

  const setZoom = useCallback((level: number) => {
    setZoomLevel(clampZoom(level));
  }, []);

  const updateOriginFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!imageRef.current) return;
      const rect = imageRef.current.getBoundingClientRect();
      setOrigin(relativeOrigin(clientX, clientY, rect));
    },
    [imageRef]
  );

  const onMouseEnter = useCallback(
    (e: MouseEvent) => {
      updateOriginFromPoint(e.clientX, e.clientY);
      setIsActive(true);
    },
    [updateOriginFromPoint]
  );

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      updateOriginFromPoint(e.clientX, e.clientY);
    },
    [updateOriginFromPoint]
  );

  const onMouseLeave = useCallback(() => {
    setIsActive(false);
  }, []);

  const clearHoldTimer = useCallback(() => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartPoint.current = { x: touch.clientX, y: touch.clientY };
      clearHoldTimer();
      holdTimer.current = setTimeout(() => {
        updateOriginFromPoint(touch.clientX, touch.clientY);
        setIsActive(true);
      }, TOUCH_HOLD_MS);
    },
    [clearHoldTimer, updateOriginFromPoint]
  );

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0];
      if (isActive) {
        e.preventDefault();
        updateOriginFromPoint(touch.clientX, touch.clientY);
        return;
      }
      const start = touchStartPoint.current;
      if (start) {
        const moved = Math.hypot(touch.clientX - start.x, touch.clientY - start.y);
        if (moved > TOUCH_MOVE_CANCEL_PX) clearHoldTimer();
      }
    },
    [isActive, clearHoldTimer, updateOriginFromPoint]
  );

  const endTouch = useCallback(() => {
    clearHoldTimer();
    touchStartPoint.current = null;
    setIsActive(false);
  }, [clearHoldTimer]);

  return {
    isActive,
    zoomLevel,
    origin,
    setZoom,
    imageHandlers: {
      onMouseEnter,
      onMouseMove,
      onMouseLeave,
      onTouchStart,
      onTouchMove,
      onTouchEnd: endTouch,
      onTouchCancel: endTouch,
    },
  };
}
