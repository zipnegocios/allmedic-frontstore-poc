'use client';

import { useEffect, type RefObject } from 'react';

/** Reproduce/pausa un <video> según su visibilidad en el viewport (evita decodificar muchos videos a la vez en una grilla). */
export function useInViewAutoplay(ref: RefObject<HTMLVideoElement | null>, options?: IntersectionObserverInit) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.play().catch(() => {});
      } else {
        el.pause();
      }
    }, { threshold: 0.5, ...options });

    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
}
