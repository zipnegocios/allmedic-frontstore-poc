import {
  getTrashedSets, restoreSet, permanentlyDeleteSet,
  getTrashedProducts, restoreProduct, permanentlyDeleteProduct,
} from './admin-data-service';
import { listTrashedQuotes, restoreQuote, permanentlyDeleteQuote } from './quotes/service';

export interface TrashedItem {
  id: string;
  name: string;
  entityType: 'SET' | 'QUOTE' | 'PRODUCT';
  deletedAt: Date;
  details: string;
}

export async function getTrashedItems(): Promise<TrashedItem[]> {
  const [trashedSets, trashedQuotes, trashedProducts] = await Promise.all([
    getTrashedSets(),
    listTrashedQuotes(),
    getTrashedProducts(),
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

  const productMapped = trashedProducts.map((p) => ({
    id: p.id,
    name: p.name,
    entityType: 'PRODUCT' as const,
    deletedAt: p.deletedAt!,
    details: `${p.brandName || 'Sin marca'} · Código ${p.code}`,
  }));

  return [...setMapped, ...quoteMapped, ...productMapped].sort(
    (a, b) => b.deletedAt.getTime() - a.deletedAt.getTime()
  );
}

export async function restoreItem(entityType: string, id: string): Promise<void> {
  if (entityType === 'SET') {
    await restoreSet(id);
  } else if (entityType === 'QUOTE') {
    await restoreQuote(id);
  } else if (entityType === 'PRODUCT') {
    await restoreProduct(id);
  } else {
    throw new Error(`Tipo de entidad no soportado para restauración: ${entityType}`);
  }
}

export async function permanentlyDeleteItem(entityType: string, id: string): Promise<void> {
  if (entityType === 'SET') {
    await permanentlyDeleteSet(id);
  } else if (entityType === 'QUOTE') {
    await permanentlyDeleteQuote(id);
  } else if (entityType === 'PRODUCT') {
    await permanentlyDeleteProduct(id);
  } else {
    throw new Error(`Tipo de entidad no soportado para eliminación permanente: ${entityType}`);
  }
}
