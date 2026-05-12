/**
 * Generate a UUID v4 that works in both Node.js and Edge Runtime.
 * Edge Runtime does not have `crypto.randomUUID()`, so we use `crypto.getRandomValues()`
 * which is available in both environments via the Web Crypto API.
 */
export function uuid(): string {
  // Use Web Crypto API (available in both Node.js and Edge Runtime)
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : (globalThis as any).crypto;
  
  if (cryptoObj?.getRandomValues) {
    const arr = new Uint8Array(16);
    cryptoObj.getRandomValues(arr);
    // Set version (4) and variant bits
    arr[6] = (arr[6] & 0x0f) | 0x40;
    arr[8] = (arr[8] & 0x3f) | 0x80;
    // Convert to UUID string
    const hex = Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Fallback (should never happen in practice)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
