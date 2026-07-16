'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { toast } from 'sonner';
import { AdminListCard } from '@/components/admin/AdminListCard';

interface Product {
  id: string;
  slug: string;
  name: string;
  sku: string | null;
  /** Nombre de `productTypes` (EAV) — fuente de verdad nueva. `null` si el producto no tiene `productTypeId` asignado. */
  productTypeName: string | null;
  gender: string;
  priceNormal: string;
  priceSale: string | null;
  discountPct: number | null;
  isNew: boolean;
  isBestSeller: boolean;
  isActive: boolean;
  brandName: string | null;
}

/** Nombre a mostrar en el listado admin para el "tipo" de un producto: usa `productTypeName`
 * (EAV, fuente de verdad); si el producto no tiene `productTypeId` asignado, muestra un placeholder. */
function displayProductType(product: Pick<Product, 'productTypeName'>): string {
  return product.productTypeName || 'Sin tipo asignado';
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('limit', '20');
      const res = await fetch(`/api/admin/products?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setProducts(data.products);
      setTotalPages(data.pages);
    } catch {
      toast.error('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Producto eliminado');
      fetchProducts();
    } catch {
      toast.error('Error al eliminar producto');
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <h1 className="text-3xl font-bold text-[#111111]">Productos</h1>
        <div className="flex flex-col md:flex-row gap-3 md:gap-4">
          <Link href="/admin/productos/nuevo">
            <Button className="w-full md:w-auto min-h-11 md:h-9 md:min-h-0 bg-[#111111]">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Producto
            </Button>
          </Link>
          <Link href="/admin/productos/nuevo?rag=true">
            <Button variant="outline" className="w-full md:w-auto min-h-11 md:h-9 md:min-h-0">
              <Package className="w-4 h-4 mr-2" />
              Crear con IA (RAG)
            </Button>
          </Link>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar productos..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10 min-h-11"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Tipo de Producto</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">No hay productos</TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-gray-500">{product.sku || 'Sin SKU'}</p>
                      </div>
                    </TableCell>
                    <TableCell>{product.brandName || '-'}</TableCell>
                    <TableCell>{displayProductType(product)}</TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">${product.priceNormal}</span>
                        {product.priceSale && (
                          <span className="text-sm text-green-600 ml-2">${product.priceSale}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {product.isNew && <Badge variant="secondary">Nuevo</Badge>}
                        {product.isBestSeller && <Badge variant="default">Top</Badge>}
                        {!product.isActive && <Badge variant="destructive">Inactivo</Badge>}
                        {product.isActive && <Badge variant="outline">Activo</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/productos/${product.id}`}>
                          <Button size="sm" variant="ghost">
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(product.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Vista tarjetas (mobile) — misma fuente de datos y handlers que la tabla */}
      <div className="md:hidden">
        {loading ? (
          <p className="text-center py-8 text-gray-500">Cargando...</p>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="mb-4">No hay productos</p>
            <Link href="/admin/productos/nuevo">
              <Button className="gap-2 min-h-11 bg-[#111111]">
                <Plus className="w-4 h-4" />
                Nuevo Producto
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {products.map((product) => (
              <AdminListCard
                key={product.id}
                href={`/admin/productos/${product.id}`}
                aria-label={`Editar producto ${product.name}`}
                title={product.name}
                subtitle={`${product.sku || 'Sin SKU'} · ${product.brandName || '-'}`}
                badges={
                  <>
                    {product.isNew && <Badge variant="secondary">Nuevo</Badge>}
                    {product.isBestSeller && <Badge variant="default">Top</Badge>}
                    {!product.isActive && <Badge variant="destructive">Inactivo</Badge>}
                    {product.isActive && <Badge variant="outline">Activo</Badge>}
                  </>
                }
                meta={
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{displayProductType(product)}</span>
                    <span aria-hidden="true">·</span>
                    {product.priceSale ? (
                      <>
                        <span className="line-through">${product.priceNormal}</span>
                        <span className="font-medium text-green-600">${product.priceSale}</span>
                      </>
                    ) : (
                      <span className="font-medium text-[#111111]">${product.priceNormal}</span>
                    )}
                  </div>
                }
                actions={[
                  {
                    key: 'delete',
                    label: 'Eliminar',
                    icon: <Trash2 className="w-4 h-4" />,
                    variant: 'destructive',
                    onSelect: () => handleDelete(product.id),
                  },
                ]}
              />
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm px-2 text-center">Página {page} de {totalPages}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
