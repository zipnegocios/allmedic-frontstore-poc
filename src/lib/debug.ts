/**
 * Debug utilities for development
 * Provides logging, performance monitoring, and state inspection tools
 */

// Environment check
const isDev = process.env.NODE_ENV === 'development';

interface DebugOptions {
  logNetwork?: boolean;
  logRenders?: boolean;
  logState?: boolean;
  performance?: boolean;
}

let debugConfig: DebugOptions = {
  logNetwork: isDev,
  logRenders: isDev,
  logState: isDev,
  performance: isDev,
};

/**
 * Configure debug settings
 */
export function configureDebug(options: Partial<DebugOptions>) {
  debugConfig = { ...debugConfig, ...options };
}

/**
 * Log component render with performance metrics
 */
export function debugRender(componentName: string, props?: Record<string, unknown>) {
  if (!debugConfig.logRenders) return;

  console.group(`%c⚛️ ${componentName}`, 'color: #61dafb; font-weight: bold');
  if (props) {
    console.log('Props:', props);
  }
  console.groupEnd();
}

/**
 * Log state changes
 */
export function debugState(stateName: string, oldValue: unknown, newValue: unknown) {
  if (!debugConfig.logState) return;

  console.group(`%c📊 State: ${stateName}`, 'color: #fbbf24; font-weight: bold');
  console.log('Old:', oldValue);
  console.log('New:', newValue);
  console.log('Changed:', oldValue !== newValue);
  console.groupEnd();
}

/**
 * Log network requests
 */
export function debugNetwork(method: string, url: string, data?: Record<string, unknown>) {
  if (!debugConfig.logNetwork) return;

  const time = new Date().toISOString();
  console.group(`%c🌐 ${method} ${url}`, 'color: #10b981; font-weight: bold');
  console.log('Time:', time);
  if (data) {
    console.log('Data:', data);
  }
  console.groupEnd();
}

/**
 * Performance measurement wrapper
 */
export function measurePerformance<T>(
  name: string,
  fn: () => T
): T {
  if (!debugConfig.performance) return fn();

  const start = performance.now();
  const result = fn();
  const end = performance.now();

  console.log(`⏱️ ${name}: ${(end - start).toFixed(2)}ms`);
  return result;
}

/**
 * Async performance measurement
 */
export async function measurePerformanceAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!debugConfig.performance) return fn();

  const start = performance.now();
  const result = await fn();
  const end = performance.now();

  console.log(`⏱️ ${name}: ${(end - start).toFixed(2)}ms`);
  return result;
}

/**
 * Inspect object structure
 */
export function inspectObject(name: string, obj: unknown, depth: number = 2) {
  console.group(`%c🔍 Inspecting ${name}`, 'color: #8b5cf6; font-weight: bold');
  const inspect = (o: unknown, d: number): unknown => {
    if (d <= 0 || o === null) return o;
    if (typeof o !== 'object') return o;

    if (Array.isArray(o)) {
      return o.map(item => inspect(item, d - 1));
    }

    const result: Record<string, unknown> = {};
    for (const key in o) {
      if (Object.prototype.hasOwnProperty.call(o, key)) {
        result[key] = inspect((o as Record<string, unknown>)[key], d - 1);
      }
    }
    return result;
  };

  console.log(inspect(obj, depth));
  console.groupEnd();
}

/**
 * Log to persistent debug log in localStorage
 */
export function debugLog(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}`;

  try {
    const logs = JSON.parse(localStorage.getItem('debug-logs') || '[]');
    logs.push({ message: logEntry, data });
    localStorage.setItem('debug-logs', JSON.stringify(logs.slice(-100))); // Keep last 100 entries
  } catch {
    console.error('Failed to write to debug log');
  }
}

/**
 * Get debug logs from localStorage
 */
export function getDebugLogs(): string {
  try {
    const logs = JSON.parse(localStorage.getItem('debug-logs') || '[]') as Array<{message: string; data: unknown}>;
    return logs.map((log) => `${log.message}\n${JSON.stringify(log.data)}`).join('\n\n');
  } catch {
    return 'No debug logs available';
  }
}

/**
 * Clear debug logs
 */
export function clearDebugLogs() {
  localStorage.removeItem('debug-logs');
  console.log('Debug logs cleared');
}

/**
 * Export debug logs as JSON
 */
export function exportDebugLogs() {
  const logs = localStorage.getItem('debug-logs');
  if (!logs) {
    console.log('No debug logs to export');
    return;
  }

  const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(logs);
  const link = document.createElement('a');
  link.setAttribute('href', dataUrl);
  link.setAttribute('download', `debug-logs-${Date.now()}.json`);
  link.click();
}

// Global debug helper
if (isDev && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__DEBUG__ = {
    config: debugConfig,
    configure: configureDebug,
    render: debugRender,
    state: debugState,
    network: debugNetwork,
    measure: measurePerformance,
    measureAsync: measurePerformanceAsync,
    inspect: inspectObject,
    log: debugLog,
    getLogs: getDebugLogs,
    clearLogs: clearDebugLogs,
    exportLogs: exportDebugLogs,
  };
  console.log('%c🐛 Debug tools available at window.__DEBUG__', 'color: #ff6b6b; font-weight: bold');
}
