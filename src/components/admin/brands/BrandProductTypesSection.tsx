'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Boxes } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface ProductTypeActivation {
  id: string;
  name: string;
  slug: string;
  isActive: boolean | null;
  isActivated: boolean;
  productCount: number;
}

/** Checklist de activación del catálogo GLOBAL de tipos de producto para esta
 * marca (`brand_product_types`). La marca no crea tipos — los consume on-demand.
 * Desactivar no borra nada: solo impide usar el tipo en productos nuevos de la
 * marca; si hay productos existentes con ese tipo, se advierte con el conteo. */
export function BrandProductTypesSection({ brandId, initialProductTypes }: { brandId: string; initialProductTypes: ProductTypeActivation[] }) {
  const [productTypes, setProductTypes] = useState<ProductTypeActivation[]>(initialProductTypes);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/admin/brands/${brandId}/product-types`);
    if (res.ok) {
      const data = await res.json();
      setProductTypes(data.productTypes);
    }
  }

  async function handleToggle(pt: ProductTypeActivation) {
    if (pt.isActivated && pt.productCount > 0) {
      const confirmed = confirm(
        `${pt.productCount} producto(s) de esta marca usan "${pt.name}". Desactivar no los elimina, pero no podrás usar este tipo en productos nuevos. ¿Continuar?`
      );
      if (!confirmed) return;
    }
    setPendingId(pt.id);
    try {
      if (pt.isActivated) {
        const res = await fetch(`/api/admin/brands/${brandId}/product-types?productTypeId=${pt.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed');
        toast.success(`"${pt.name}" desactivado para esta marca`);
      } else {
        const res = await fetch(`/api/admin/brands/${brandId}/product-types`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productTypeId: pt.id }),
        });
        if (!res.ok) throw new Error('Failed');
        toast.success(`"${pt.name}" activado para esta marca`);
      }
      await refresh();
    } catch {
      toast.error('Error al actualizar la activación');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-semibold text-[#111111]">Tipos de Producto Activados</h2>
        <Link href="/admin/tipos-producto" className="text-sm text-gray-500 underline">
          Gestionar catálogo global
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Elige qué tipos del catálogo global puede usar esta marca al dar de alta un producto.
      </p>

      <Card>
        <CardContent className="p-4">
          {productTypes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Boxes className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              No hay tipos de producto en el catálogo global todavía.{' '}
              <Link href="/admin/tipos-producto" className="underline">Crear el primero</Link>.
            </div>
          ) : (
            <div className="space-y-2">
              {productTypes.map((pt) => (
                <div key={pt.id} className="flex flex-wrap items-center justify-between gap-2 border rounded px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{pt.name}</p>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{pt.slug}</code>
                    {pt.productCount > 0 && (
                      <span className="text-xs text-gray-500 ml-2">{pt.productCount} producto(s) de esta marca</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!pt.isActive && <Badge variant="destructive">Inactivo (global)</Badge>}
                    <Button
                      size="sm"
                      variant={pt.isActivated ? 'outline' : 'default'}
                      className={pt.isActivated ? '' : 'bg-[#111111]'}
                      disabled={pendingId === pt.id}
                      onClick={() => handleToggle(pt)}
                    >
                      {pt.isActivated ? 'Desactivar' : 'Activar'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
