import { useEffect, useRef } from 'react';
import { debugRender, debugState, measurePerformance } from '@/lib/debug';

/**
 * Hook for debugging React component renders and state changes
 *
 * Usage:
 * const debug = useDebug('MyComponent');
 * debug.render(props);
 * debug.state('myState', oldValue, newValue);
 */
export function useDebug(componentName: string) {
  const renderCount = useRef(0);

  useEffect(() => {
    renderCount.current += 1;
    debugRender(componentName, { renderCount: renderCount.current });
  });

  return {
    name: componentName,
    renderCount: renderCount.current,
    log: (message: string, data?: any) => {
      console.log(`[${componentName}] ${message}`, data);
    },
    state: (stateName: string, oldValue: any, newValue: any) => {
      debugState(`${componentName}.${stateName}`, oldValue, newValue);
    },
  };
}

/**
 * Hook for measuring component performance
 */
export function usePerformance(componentName: string) {
  return (operationName: string, fn: () => void) => {
    measurePerformance(`${componentName}.${operationName}`, fn);
  };
}

/**
 * Hook for tracking props changes
 */
export function usePropsDebug<T extends Record<string, any>>(
  componentName: string,
  props: T
) {
  const prevPropsRef = useRef<T>(props);

  useEffect(() => {
    const prevProps = prevPropsRef.current;
    const changedKeys: string[] = [];

    for (const key in props) {
      if (prevProps[key] !== props[key]) {
        changedKeys.push(key);
      }
    }

    if (changedKeys.length > 0) {
      console.group(`%c${componentName} props changed`, 'color: #3b82f6; font-weight: bold');
      changedKeys.forEach(key => {
        console.log(`${key}: ${prevProps[key]} → ${props[key]}`);
      });
      console.groupEnd();
    }

    prevPropsRef.current = props;
  }, [componentName, props]);
}
