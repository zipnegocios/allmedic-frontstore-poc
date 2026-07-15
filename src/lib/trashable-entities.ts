import { getTrashedSets, restoreSet, permanentlyDeleteSet } from './admin-data-service';
import { listTrashedQuotes, restoreQuote, permanentlyDeleteQuote } from './quotes/service';

export interface TrashedItem {
  id: string;
  name: string;
  entityType: 'SET' | 'QUOTE';
  deletedAt: Date;
  details: string;
}

export async function getTrashedItems(): Promise<TrashedItem[]> {
  const [trashedSets, trashedQuotes] = await Promise.all([
    getTrashedSets(),
    listTrashedQuotes(),
  ]);

  const setMapped = trashedSets.map((set) => ({
    id: set.id,
    name: set.name,
    entityType: 'SET' as const,
    deletedAt: set.deletedAt!,
    details: `${set.groupName || 'Sin grupo'} · ${set.brandName || 'Multi-marca'} · ${set.itemCount} ${set.itemCount === 1 ? 'pieza' : 'piezas'}`,
  }));

  const quoteMapped = trashedQuotes.map((q) => ({
    id: q.id,
    name: q.customerName,
    entityType: 'QUOTE' as const,
    deletedAt: q.deletedAt!,
    details: `${q.quoteNumber || 'Borrador'} · ${q.channel === 'CORPORATE' ? 'Corporativo' : 'Individual'} · $${Number(q.total).toFixed(2)}`,
  }));

  return [...setMapped, ...quoteMapped].sort(
    (a, b) => b.deletedAt.getTime() - a.deletedAt.getTime()
  );
}

export async function restoreItem(entityType: string, id: string): Promise<void> {
  if (entityType === 'SET') {
    await restoreSet(id);
  } else if (entityType === 'QUOTE') {
    await restoreQuote(id);
  } else {
    throw new Error(`Tipo de entidad no soportado para restauración: ${entityType}`);
  }
}

export async function permanentlyDeleteItem(entityType: string, id: string): Promise<void> {
  if (entityType === 'SET') {
    await permanentlyDeleteSet(id);
  } else if (entityType === 'QUOTE') {
    await permanentlyDeleteQuote(id);
  } else {
    throw new Error(`Tipo de entidad no soportado para eliminación permanente: ${entityType}`);
  }
}
