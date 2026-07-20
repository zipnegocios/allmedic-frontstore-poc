/** Índices de `items` cuyo `productId` ya apareció antes en la lista — usado por
 * los schemas Zod de crear/editar set (anti-duplicados, PLAN-ajustes-admin-sets.md
 * Fase 3.2) y extraído a un módulo sin dependencias de Next.js para poder testear
 * la lógica de forma aislada. */
export function findDuplicateSetItemIndexes(items: Array<{ productId: string }>): number[] {
  const seen = new Set<string>();
  const duplicateIndexes: number[] = [];
  items.forEach((item, idx) => {
    if (seen.has(item.productId)) duplicateIndexes.push(idx);
    seen.add(item.productId);
  });
  return duplicateIndexes;
}
