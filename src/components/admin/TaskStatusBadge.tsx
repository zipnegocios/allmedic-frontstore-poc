'use client';

import { Badge } from '@/components/ui/badge';

export type CatalogTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REJECTED';

/**
 * Único punto de mapeo estado→color/etiqueta (plan 2026-07-27, decisión 2) — usado en listado
 * de tareas, quicklink de productos y modal de detalle, para no duplicar el mapeo en varios
 * lugares. El enum de BD no cambia, solo la representación visual:
 * - PENDING → "Pendiente" (gris)
 * - IN_PROGRESS → "En progreso" (amarillo)
 * - COMPLETED → dos chips simultáneos: "Completada" (azul) + "Por revisar" (naranja)
 * - REJECTED → "Corregir" (rojo)
 * - APPROVED → "Finalizada" (verde)
 */
const STATUS_STYLES: Record<CatalogTaskStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pendiente', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  IN_PROGRESS: { label: 'En progreso', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  COMPLETED: { label: 'Completada', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  REJECTED: { label: 'Corregir', className: 'bg-red-100 text-red-800 border-red-200' },
  APPROVED: { label: 'Finalizada', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};

export function TaskStatusBadge({ status, className }: { status: CatalogTaskStatus; className?: string }) {
  if (status === 'COMPLETED') {
    return (
      <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
        <Badge variant="outline" className={STATUS_STYLES.COMPLETED.className}>{STATUS_STYLES.COMPLETED.label}</Badge>
        <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">Por revisar</Badge>
      </span>
    );
  }

  const style = STATUS_STYLES[status];
  return (
    <Badge variant="outline" className={`${style.className} ${className ?? ''}`}>
      {style.label}
    </Badge>
  );
}
