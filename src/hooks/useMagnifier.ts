'use client';

import { useCallback, useRef, useState, type MouseEvent, type RefObject, type TouchEvent, type TouchList } from 'react';

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
    onClick: (e: MouseEvent) => void;
    onMouseMove: (e: MouseEvent) => void;
    onMouseLeave: () => void;
    onTouchStart: (e: TouchEvent) => void;
    onTouchMove: (e: TouchEvent) => void;
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

function touchDistance(touches: TouchList): number {
  const [a, b] = [touches[0], touches[1]];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/** Estado y gestos de una lupa de magnificación sobre un contenedor con ref propia —
 * sin conocimiento de qué se renderiza dentro (reusable por cualquier imagen). */
export function useMagnifier(containerRef: RefObject<HTMLElement | null>): UseMagnifierResult {
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
    (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setOrigin(relativeOrigin(e.clientX, e.clientY, rect));
      toggle();
    },
    [containerRef, toggle]
  );

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
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
    (e: TouchEvent) => {
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
    (e: TouchEvent) => {
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
