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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Package, SlidersHorizontal, Columns3, ImageOff } from 'lucide-react';
import { toast } from 'sonner';
import { AdminListCard } from '@/components/admin/AdminListCard';
import { ResponsiveDialog } from '@/components/admin/ResponsiveDialog';
import { countActiveFilters } from '@/lib/admin-list-filters';
import { GENDERS, VISIBILITY_OPTIONS } from '@/components/admin/product-form/schema';

interface Product {
  id: string;
  slug: string;
  name: string;
  sku: string | null;
  code: string;
  productTypeId: string | null;
  productTypeName: string | null;
  collectionId: string | null;
  collectionName: string | null;
  gender: string;
  priceNormal: string;
  priceSale: string | null;
  discountPct: number | null;
  visibility: string;
  isNew: boolean;
  isBestSeller: boolean;
  isActive: boolean;
  brandName: string | null;
  coverUrl: string | null;
  styles: Record<string, string[]>;
}

interface OptionRef {
  id: string;
  name: string;
}

interface AttributeRef {
  id: string;
  name: string;
  slug: string;
}

interface AttributeValueRef {
  id: string;
  value: string;
}

/** Nombre a mostrar en el listado admin para el "tipo" de un producto: usa `productTypeName`
 * (EAV, fuente de verdad); si el producto no tiene `productTypeId` asignado, muestra un placeholder. */
function displayProductType(product: Pick<Product, 'productTypeName'>): string {
  return product.productTypeName || 'Sin tipo asignado';
}

const VISIBILITY_LABELS: Record<string, string> = Object.fromEntries(
  VISIBILITY_OPTIONS.map((v) => [v.value, v.label])
);
const GENDER_LABELS: Record<string, string> = Object.fromEntries(GENDERS.map((g) => [g.value, g.label]));

// ─── Columnas activables/desactivables ───
// "Producto" (nombre + código) y "Acciones" quedan siempre visibles como identidad
// mínima de la fila; el resto se puede ocultar para enfocar el listado.
const COLUMN_DEFS = [
  { key: 'thumbnail', label: 'Miniatura' },
  { key: 'brand', label: 'Marca' },
  { key: 'collection', label: 'Colección' },
  { key: 'productType', label: 'Tipo de Producto' },
  { key: 'attributes', label: 'Atributos' },
  { key: 'gender', label: 'Género' },
  { key: 'visibility', label: 'Visibilidad' },
  { key: 'price', label: 'Precio' },
  { key: 'status', label: 'Estado' },
] as const;

type ColumnKey = (typeof COLUMN_DEFS)[number]['key'];

const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = ['thumbnail', 'brand', 'productType', 'price', 'status'];
const COLUMNS_STORAGE_KEY = 'admin-productos-columnas';

function loadVisibleColumns(): Set<ColumnKey> {
  if (typeof window === 'undefined') return new Set(DEFAULT_VISIBLE_COLUMNS);
  try {
    const raw = window.localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return new Set(DEFAULT_VISIBLE_COLUMNS);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set(DEFAULT_VISIBLE_COLUMNS);
    const valid = parsed.filter((k): k is ColumnKey => COLUMN_DEFS.some((c) => c.key === k));
    return valid.length > 0 ? new Set(valid) : new Set(DEFAULT_VISIBLE_COLUMNS);
  } catch {
    return new Set(DEFAULT_VISIBLE_COLUMNS);
  }
}

function AttributesBadges({ styles }: { styles: Record<string, string[]> }) {
  const entries = Object.entries(styles);
  if (entries.length === 0) return <span className="text-gray-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([slug, values]) => (
        <Badge key={slug} variant="outline" className="text-[10px] font-normal">
          {slug}: {values.join(', ')}
        </Badge>
      ))}
    </div>
  );
}

function ProductThumbnail({ url, name }: { url: string | null; name: string }) {
  if (!url) {
    return (
      <div className="w-10 h-10 rounded bg-gray-100 border flex items-center justify-center flex-shrink-0">
        <ImageOff className="w-4 h-4 text-gray-300" />
      </div>
    );
  }
  return <img src={url} alt={name} className="w-10 h-10 rounded object-cover border flex-shrink-0" />;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // ─── Filtros ───
  const [brandId, setBrandId] = useState('ALL');
  const [collectionId, setCollectionId] = useState('ALL');
  const [productTypeId, setProductTypeId] = useState('ALL');
  const [attributeId, setAttributeId] = useState('ALL');
  const [attributeValueId, setAttributeValueId] = useState('ALL');
  const [gender, setGender] = useState('ALL');
  const [visibility, setVisibility] = useState('ALL');
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'true' | 'false'
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ─── Columnas visibles (persistidas en localStorage) ───
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => new Set(DEFAULT_VISIBLE_COLUMNS));
  useEffect(() => {
    setVisibleColumns(loadVisibleColumns());
  }, []);

  function toggleColumn(key: ColumnKey) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }

  // ─── Datos de referencia para los filtros ───
  const [brands, setBrands] = useState<OptionRef[]>([]);
  const [collections, setCollections] = useState<OptionRef[]>([]);
  const [productTypes, setProductTypes] = useState<OptionRef[]>([]);
  const [attributes, setAttributes] = useState<AttributeRef[]>([]);
  const [attributeValues, setAttributeValues] = useState<AttributeValueRef[]>([]);

  useEffect(() => {
    async function loadReferenceData() {
      try {
        const [brandsRes, attributesRes] = await Promise.all([
          fetch('/api/admin/brands?limit=1000'),
          fetch('/api/admin/attributes'),
        ]);
        if (brandsRes.ok) setBrands((await brandsRes.json()).brands || []);
        if (attributesRes.ok) setAttributes((await attributesRes.json()).attributes || []);
      } catch {
        toast.error('Error al cargar datos de referencia');
      }
    }
    loadReferenceData();
  }, []);

  // Colecciones/tipos de producto: alcance global si no hay marca elegida en el
  // filtro, o solo los de esa marca — mismo criterio "sin opción muerta" que
  // `ProductForm` (no ofrecer combinaciones que no existen).
  useEffect(() => {
    async function loadScopedOptions() {
      try {
        const qs = brandId !== 'ALL' ? `?brandId=${brandId}` : '';
        const [colRes, ptRes] = await Promise.all([
          fetch(`/api/admin/collections${qs}`),
          fetch(`/api/admin/product-types${qs}`),
        ]);
        if (colRes.ok) setCollections((await colRes.json()).collections || []);
        if (ptRes.ok) setProductTypes((await ptRes.json()).productTypes || []);
      } catch {
        toast.error('Error al cargar colecciones/tipos de producto');
      }
    }
    loadScopedOptions();
  }, [brandId]);

  // Cascada Atributo → Valor para el filtro de Estilos (EAV).
  useEffect(() => {
    setAttributeValueId('ALL');
    if (attributeId === 'ALL') {
      setAttributeValues([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/attributes/${attributeId}/values`);
        if (cancelled) return;
        if (res.ok) setAttributeValues((await res.json()).values || []);
      } catch {
        if (!cancelled) toast.error('Error al cargar valores del atributo');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attributeId]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (brandId !== 'ALL') params.set('brandId', brandId);
      if (collectionId !== 'ALL') params.set('collectionId', collectionId);
      if (productTypeId !== 'ALL') params.set('productTypeId', productTypeId);
      if (gender !== 'ALL') params.set('gender', gender);
      if (visibility !== 'ALL') params.set('visibility', visibility);
      if (activeFilter !== 'ALL') params.set('isActive', activeFilter);
      if (attributeId !== 'ALL' && attributeValueId !== 'ALL') {
        const attr = attributes.find((a) => a.id === attributeId);
        const val = attributeValues.find((v) => v.id === attributeValueId);
        if (attr && val) {
          params.set('attributeSlug', attr.slug);
          params.set('attributeValue', val.value);
        }
      }
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
  }, [search, page, brandId, collectionId, productTypeId, gender, visibility, activeFilter, attributeId, attributeValueId, attributes, attributeValues]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  function handleBrandFilterChange(value: string) {
    setBrandId(value);
    setCollectionId('ALL');
    setProductTypeId('ALL');
    setPage(1);
  }

  function withPageReset<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

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

  const activeFilterCount = countActiveFilters([
    brandId, collectionId, productTypeId, attributeId, gender, visibility, activeFilter,
  ]);

  const visibleColumnDefs = COLUMN_DEFS.filter((c) => visibleColumns.has(c.key));
  // "Miniatura" no tiene columna propia: se renderiza inline dentro de la celda
  // "Producto" (junto al nombre), así que se excluye de los headers/celdas
  // genéricas para no desalinear el resto de las columnas con un header fantasma
  // sin celda correspondiente.
  const tableColumnDefs = visibleColumnDefs.filter((c) => c.key !== 'thumbnail');
  const desktopColSpan = 2 + tableColumnDefs.length; // Producto + Acciones + toggleables (sin miniatura)

  const filtersContent = (
    <div className="flex flex-col gap-4 py-2">
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-gray-700">Marca</p>
        <Select value={brandId} onValueChange={handleBrandFilterChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las marcas</SelectItem>
            {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-gray-700">Colección</p>
        <Select value={collectionId} onValueChange={withPageReset(setCollectionId)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las colecciones</SelectItem>
            {collections.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-gray-700">Tipo de Producto</p>
        <Select value={productTypeId} onValueChange={withPageReset(setProductTypeId)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los tipos</SelectItem>
            {productTypes.map((pt) => <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-gray-700">Atributo (Estilo)</p>
        <Select value={attributeId} onValueChange={withPageReset(setAttributeId)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los atributos</SelectItem>
            {attributes.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {attributeId !== 'ALL' && (
          <Select value={attributeValueId} onValueChange={withPageReset(setAttributeValueId)}>
            <SelectTrigger><SelectValue placeholder="Valor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Cualquier valor</SelectItem>
              {attributeValues.map((v) => <SelectItem key={v.id} value={v.id}>{v.value}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-gray-700">Género</p>
        <Select value={gender} onValueChange={withPageReset(setGender)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los géneros</SelectItem>
            {GENDERS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-gray-700">Visibilidad</p>
        <Select value={visibility} onValueChange={withPageReset(setVisibility)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas</SelectItem>
            {VISIBILITY_OPTIONS.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-gray-700">Estado</p>
        <Select value={activeFilter} onValueChange={withPageReset(setActiveFilter)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="true">Activos</SelectItem>
            <SelectItem value="false">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

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
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre, SKU o código..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10 min-h-11"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="min-h-11 justify-between gap-2"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filtros
              {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-h-11 gap-2">
                  <Columns3 className="w-4 h-4" />
                  Columnas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Columnas visibles</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {COLUMN_DEFS.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.key}
                    checked={visibleColumns.has(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <ResponsiveDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title="Filtros"
        description="Filtra el listado de productos por marca, colección, tipo, atributos y más."
        footer={
          <Button className="w-full min-h-11" onClick={() => setFiltersOpen(false)}>
            Ver resultados
          </Button>
        }
      >
        {filtersContent}
      </ResponsiveDialog>

      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                {tableColumnDefs.map((col) => <TableHead key={col.key}>{col.label}</TableHead>)}
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={desktopColSpan} className="text-center py-8">Cargando...</TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={desktopColSpan} className="text-center py-8 text-gray-500">No hay productos</TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {visibleColumns.has('thumbnail') && (
                          <ProductThumbnail url={product.coverUrl} name={product.name} />
                        )}
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-gray-500">{product.code}</p>
                        </div>
                      </div>
                    </TableCell>
                    {tableColumnDefs.map((col) => {
                      switch (col.key) {
                        case 'brand':
                          return <TableCell key={col.key}>{product.brandName || '-'}</TableCell>;
                        case 'collection':
                          return <TableCell key={col.key}>{product.collectionName || '-'}</TableCell>;
                        case 'productType':
                          return <TableCell key={col.key}>{displayProductType(product)}</TableCell>;
                        case 'attributes':
                          return <TableCell key={col.key}><AttributesBadges styles={product.styles} /></TableCell>;
                        case 'gender':
                          return <TableCell key={col.key}>{GENDER_LABELS[product.gender] || product.gender}</TableCell>;
                        case 'visibility':
                          return <TableCell key={col.key}>{VISIBILITY_LABELS[product.visibility] || product.visibility}</TableCell>;
                        case 'price':
                          return (
                            <TableCell key={col.key}>
                              <span className="font-medium">${product.priceNormal}</span>
                              {product.priceSale && (
                                <span className="text-sm text-green-600 ml-2">${product.priceSale}</span>
                              )}
                            </TableCell>
                          );
                        case 'status':
                          return (
                            <TableCell key={col.key}>
                              <div className="flex gap-1 flex-wrap">
                                {product.isNew && <Badge variant="secondary">Nuevo</Badge>}
                                {product.isBestSeller && <Badge variant="default">Top</Badge>}
                                {!product.isActive && <Badge variant="destructive">Inactivo</Badge>}
                                {product.isActive && <Badge variant="outline">Activo</Badge>}
                              </div>
                            </TableCell>
                          );
                        default:
                          return null;
                      }
                    })}
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
                thumbnail={
                  visibleColumns.has('thumbnail')
                    ? <ProductThumbnail url={product.coverUrl} name={product.name} />
                    : undefined
                }
                title={product.name}
                subtitle={`${product.code} · ${product.brandName || '-'}`}
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
                    {visibleColumns.has('collection') && product.collectionName && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{product.collectionName}</span>
                      </>
                    )}
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
