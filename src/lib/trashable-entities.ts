import { getTrashedSets, restoreSet, permanentlyDeleteSet } from './admin-data-service';

export interface TrashedItem {
  id: string;
  name: string;
  entityType: 'SET';
  deletedAt: Date;
  details: string;
}

export async function getTrashedItems(): Promise<TrashedItem[]> {
  const trashedSets = await getTrashedSets();
  return trashedSets.map((set) => ({
    id: set.id,
    name: set.name,
    entityType: 'SET',
    deletedAt: set.deletedAt!,
    details: `${set.groupName || 'Sin grupo'} · ${set.brandName || 'Multi-marca'} · ${set.itemCount} ${set.itemCount === 1 ? 'pieza' : 'piezas'}`,
  }));
}

export async function restoreItem(entityType: string, id: string): Promise<void> {
  if (entityType === 'SET') {
    await restoreSet(id);
  } else {
    throw new Error(`Tipo de entidad no soportado para restauración: ${entityType}`);
  }
}

export async function permanentlyDeleteItem(entityType: string, id: string): Promise<void> {
  if (entityType === 'SET') {
    await permanentlyDeleteSet(id);
  } else {
    throw new Error(`Tipo de entidad no soportado para eliminación permanente: ${entityType}`);
  }
}
