import { useEffect, useState } from 'react';

/**
 * Alterna entre los textos dados cada `intervalMs`, con fade suave.
 * Respeta `prefers-reduced-motion` (alterna sin transición de fade).
 */
export function useAlternatingText(texts: string[], intervalMs = 7000) {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      const timer = setInterval(() => {
        setIndex((prev) => (prev + 1) % texts.length);
      }, intervalMs);
      return () => clearInterval(timer);
    }

    const timer = setInterval(() => {
      setFade(false);
      const switchTimeout = setTimeout(() => {
        setIndex((prev) => (prev + 1) % texts.length);
        setFade(true);
      }, 300);
      return () => clearTimeout(switchTimeout);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [texts.length, intervalMs]);

  return { text: texts[index], fade };
}
