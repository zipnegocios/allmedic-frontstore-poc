/** Índices de una lista plana de piezas cuyo `productId` ya apareció antes — usado por los
 * schemas Zod de crear/editar set (anti-duplicados, PLAN-ajustes-admin-sets.md Fase 3.2) y
 * extraído a un módulo sin dependencias de Next.js para poder testear la lógica de forma
 * aislada. Con el modelo de bloques, la lista a validar es el aplanado de las 4 opciones de
 * bloque + las piezas recomendadas — ver `findDuplicateSetProductIds`. */
export function findDuplicateSetItemIndexes(items: Array<{ productId: string }>): number[] {
  const seen = new Set<string>();
  const duplicateIndexes: number[] = [];
  items.forEach((item, idx) => {
    if (seen.has(item.productId)) duplicateIndexes.push(idx);
    seen.add(item.productId);
  });
  return duplicateIndexes;
}

/** Ids de producto que aparecen más de una vez entre los 2 bloques (4 opciones) y las piezas
 * recomendadas de un set — un mismo producto no puede ser 2 opciones del mismo o distinto bloque,
 * ni tampoco aparecer a la vez como opción de bloque y como pieza recomendada. */
export function findDuplicateSetProductIds(
  blocks: Array<{ options: Array<{ productId: string }> }>,
  recommendedItems: Array<{ productId: string }>
): string[] {
  const allIds = [...blocks.flatMap((b) => b.options.map((o) => o.productId)), ...recommendedItems.map((r) => r.productId)]
    .filter((id) => id.length > 0);
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of allIds) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return Array.from(duplicates);
}
