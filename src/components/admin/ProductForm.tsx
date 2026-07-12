'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Save, Plus, Trash2, ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { MediaPicker } from '@/components/admin/media/MediaPicker';
import { MediaThumb } from '@/components/admin/media/MediaThumb';
import { resolveMediaUrl } from '@/lib/media';

// ─── Schemas ───

const VariantSchema = z.object({
  id: z.string().optional(),
  colorId: z.string().min(1, 'Color requerido'),
  size: z.string().min(1, 'Talla requerida'),
  fit: z.string().optional(),
  sku: z.string().min(1, 'SKU requerido'),
  status: z.enum(['AVAILABLE', 'BACKORDER', 'OUT_OF_STOCK']).default('AVAILABLE'),
  stock: z.coerce.number().min(0).default(0),
  minStock: z.coerce.number().min(0).default(5),
});

const ImageSchema = z.object({
  id: z.string().optional(),
  assetId: z.string().min(1, 'Medio requerido'),
  colorId: z.string().optional(),
  url: z.string().optional(), // solo para previsualización en el form, no se persiste
  storageKey: z.string().optional(), // solo para previsualización en el form, no se persiste
  mimeType: z.string().optional(), // solo para previsualización en el form, no se persiste
  alt: z.string().optional(),
  sortOrder: z.coerce.number().default(0),
});

const ProductFormSchema = z.object({
  slug: z.string().min(1, 'Slug requerido'),
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional(),
  sku: z.string().optional(),
  brandId: z.string().min(1, 'Marca requerida'),
  collectionId: z.string().optional(),
  category: z.string().min(1, 'Categoría requerida'),
  productType: z.string().optional(),
  gender: z.string().min(1, 'Género requerido'),
  priceNormal: z.string().min(1, 'Precio requerido'),
  priceSale: z.string().optional(),
  discountPct: z.coerce.number().min(0).max(100).optional(),
  discountEnd: z.string().optional(),
  priceWholesale: z.string().optional(),
  priceWholesaleSale: z.string().optional(),
  wholesaleDiscountEnd: z.string().optional(),
  visibility: z.enum(['INDIVIDUAL', 'GROUPS', 'BOTH']).default('INDIVIDUAL'),
  isNew: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  isActive: z.boolean().default(true),
  features: z.array(z.string()).default([]),
  careInstructions: z.array(z.string()).default([]),
  styles: z.array(z.string()).default([]),
  crossSellId: z.string().optional(),
  variants: z.array(VariantSchema).default([]),
  images: z.array(ImageSchema).default([]),
});

type ProductFormData = z.infer<typeof ProductFormSchema>;

// ─── Types ───

interface Brand {
  id: string;
  name: string;
}

interface Color {
  id: string;
  name: string;
  code: string;
  hex: string;
}

interface ProductFormProps {
  productId?: string;
  initialData?: ProductFormData;
  /** Modo embebido (ej. drawer del ensamblador de sets): sin encabezado de página propio,
   * sin `router.push` — el guardado/cancelación se comunican vía `onSaved`/`onCancel`. */
  embedded?: boolean;
  /** Visibilidad preseleccionada en modo creación embebida (ej. "GROUPS" al crear una pieza
   * desde el ensamblador de sets). Sin efecto si `initialData` ya trae una visibilidad. */
  initialVisibility?: ProductFormData['visibility'];
  onSaved?: (product: { id: string } & Record<string, unknown>) => void;
  onCancel?: () => void;
}

const CATEGORIES = ['Camisas', 'Pantalones', 'Chaquetas', 'Conjuntos', 'Accesorios', 'Batas'];
const GENDERS = [
  { value: 'MUJER', label: 'Mujer' },
  { value: 'HOMBRE', label: 'Hombre' },
  { value: 'UNISEX', label: 'Unisex' },
];
const SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL', 'OS'];
const FITS = ['Petite', 'Regular', 'Tall', 'Short'];
const SELECT_EMPTY_VALUE = '__empty__';

const VISIBILITY_OPTIONS = [
  { value: 'INDIVIDUAL', label: 'Solo Individual', description: 'Visible solo en el catálogo individual (/catalogo)' },
  { value: 'GROUPS', label: 'Solo Grupos', description: 'Solo disponible como pieza de sets corporativos, no aparece en /catalogo' },
  { value: 'BOTH', label: 'Ambos', description: 'Visible en el catálogo individual y disponible como pieza de sets' },
];

const STATUSES = [
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'BACKORDER', label: 'Pedido especial' },
  { value: 'OUT_OF_STOCK', label: 'Agotado' },
];

// ─── Component ───

export default function ProductForm({
  productId,
  initialData,
  embedded = false,
  initialVisibility,
  onSaved,
  onCancel,
}: ProductFormProps) {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [featureInput, setFeatureInput] = useState('');
  const [careInput, setCareInput] = useState('');
  const [styleInput, setStyleInput] = useState('');
  const [pickerTargetIndex, setPickerTargetIndex] = useState<number | 'append' | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(ProductFormSchema) as any,
    defaultValues: initialData || {
      slug: '',
      name: '',
      description: '',
      sku: '',
      brandId: '',
      category: '',
      gender: 'UNISEX',
      priceNormal: '',
      visibility: initialVisibility ?? 'INDIVIDUAL',
      isNew: false,
      isBestSeller: false,
      isActive: true,
      features: [],
      careInstructions: [],
      styles: [],
      variants: [],
      images: [],
    },
  });

  const {
    fields: variantFields,
    append: appendVariant,
    remove: removeVariant,
  } = useFieldArray({ control, name: 'variants' });

  const {
    fields: imageFields,
    append: appendImage,
    remove: removeImage,
  } = useFieldArray({ control, name: 'images' });

  const features = watch('features');
  const careInstructions = watch('careInstructions');
  const styles = watch('styles');

  // Fetch brands and colors
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [brandsRes, colorsRes] = await Promise.all([
          fetch('/api/admin/brands?limit=1000'),
          fetch('/api/admin/colors?limit=1000'),
        ]);
        if (brandsRes.ok) {
          const b = await brandsRes.json();
          setBrands(b.brands || []);
        }
        if (colorsRes.ok) {
          const c = await colorsRes.json();
          setColors(c.colors || []);
        }
      } catch {
        toast.error('Error al cargar datos de referencia');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Auto-generate slug from name
  const nameValue = watch('name');
  const slugValue = watch('slug');
  useEffect(() => {
    if (!productId && nameValue && !slugValue) {
      setValue('slug', nameValue.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  }, [nameValue, slugValue, productId, setValue]);

  async function onSubmit(data: ProductFormData) {
    setSaving(true);
    try {
      const url = productId ? `/api/admin/products/${productId}` : '/api/admin/products';
      const method = productId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al guardar');
      }
      const saved = await res.json();
      toast.success(productId ? 'Producto actualizado' : 'Producto creado');
      if (embedded) {
        onSaved?.(saved);
        return;
      }
      router.push('/admin/products');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  function addFeature() {
    if (featureInput.trim()) {
      setValue('features', [...features, featureInput.trim()]);
      setFeatureInput('');
    }
  }

  function removeFeature(idx: number) {
    setValue('features', features.filter((_, i) => i !== idx));
  }

  function addCare() {
    if (careInput.trim()) {
      setValue('careInstructions', [...careInstructions, careInput.trim()]);
      setCareInput('');
    }
  }

  function removeCare(idx: number) {
    setValue('careInstructions', careInstructions.filter((_, i) => i !== idx));
  }

  function addStyle() {
    if (styleInput.trim()) {
      setValue('styles', [...styles, styleInput.trim()]);
      setStyleInput('');
    }
  }

  function removeStyle(idx: number) {
    setValue('styles', styles.filter((_, i) => i !== idx));
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'p-8 max-w-5xl'}>
      <div className="flex items-center justify-between mb-8">
        {embedded ? (
          <h2 className="text-xl font-bold text-[#111111]">
            {productId ? 'Editar producto' : 'Nuevo producto'}
          </h2>
        ) : (
          <div className="flex items-center gap-4">
            <Link href="/admin/products">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-[#111111]">
              {productId ? 'Editar Producto' : 'Nuevo Producto'}
            </h1>
          </div>
        )}
        <div className="flex items-center gap-2">
          {embedded && (
            <Button type="button" variant="outline" onClick={() => onCancel?.()}>
              Cancelar
            </Button>
          )}
          <Button
            onClick={() => handleSubmit(onSubmit)()}
            disabled={saving}
            className="bg-[#111111]"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(onSubmit)(); }}>
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="bg-white border">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="variants">
              Variantes
              {variantFields.length > 0 && (
                <Badge variant="secondary" className="ml-2">{variantFields.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="images">
              Medios
              {imageFields.length > 0 && (
                <Badge variant="secondary" className="ml-2">{imageFields.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ─── TAB GENERAL ─── */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre *</Label>
                    <Input id="name" {...register('name')} />
                    {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug *</Label>
                    <Input id="slug" {...register('slug')} />
                    {errors.slug && <p className="text-sm text-red-500">{errors.slug.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea id="description" {...register('description')} rows={4} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU</Label>
                    <Input id="sku" {...register('sku')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brandId">Marca *</Label>
                    <Controller
                      name="brandId"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar marca" />
                          </SelectTrigger>
                          <SelectContent>
                            {brands.map(b => (
                              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.brandId && <p className="text-sm text-red-500">{errors.brandId.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoría *</Label>
                    <Controller
                      name="category"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar categoría" />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(c => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.category && <p className="text-sm text-red-500">{errors.category.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gender">Género *</Label>
                    <Controller
                      name="gender"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar género" />
                          </SelectTrigger>
                          <SelectContent>
                            {GENDERS.map(g => (
                              <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priceNormal">Precio Normal *</Label>
                    <Input id="priceNormal" type="number" step="0.01" {...register('priceNormal')} />
                    {errors.priceNormal && <p className="text-sm text-red-500">{errors.priceNormal.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priceSale">Precio Oferta</Label>
                    <Input id="priceSale" type="number" step="0.01" {...register('priceSale')} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="discountPct">% Descuento</Label>
                    <Input id="discountPct" type="number" min={0} max={100} {...register('discountPct')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="discountEnd">Fin de descuento</Label>
                    <Input id="discountEnd" type="datetime-local" {...register('discountEnd')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="productType">Tipo de Producto</Label>
                    <Input id="productType" {...register('productType')} placeholder="Ej: Scrub, Bata..." />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Label htmlFor="visibility">Visibilidad *</Label>
                  <Controller
                    name="visibility"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar visibilidad" />
                        </SelectTrigger>
                        <SelectContent>
                          {VISIBILITY_OPTIONS.map(v => (
                            <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="text-xs text-gray-500">
                    {VISIBILITY_OPTIONS.find(v => v.value === watch('visibility'))?.description}
                  </p>
                  {embedded && watch('visibility') === 'INDIVIDUAL' && (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1.5">
                      Con visibilidad &quot;Solo Individual&quot; este producto no aparecerá como pieza elegible en
                      ningún set corporativo — cámbiala a &quot;Solo Grupos&quot; o &quot;Ambos&quot; si vas a usarlo aquí.
                    </p>
                  )}
                </div>

                <div className="flex gap-6 pt-2">
                  <div className="flex items-center gap-2">
                    <Controller
                      name="isNew"
                      control={control}
                      render={({ field }) => (
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                    <Label>Nuevo</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Controller
                      name="isBestSeller"
                      control={control}
                      render={({ field }) => (
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                    <Label>Best Seller</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Controller
                      name="isActive"
                      control={control}
                      render={({ field }) => (
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                    <Label>Activo</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Precios al Mayor (Catálogo Corporativo) */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h3 className="font-semibold">Precios al Mayor</h3>
                  <p className="text-xs text-gray-500">
                    Usados para calcular el precio referencial de sets corporativos. Opcionales si el producto es &quot;Solo Individual&quot;.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priceWholesale">Precio al Mayor</Label>
                    <Input id="priceWholesale" type="number" step="0.01" {...register('priceWholesale')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priceWholesaleSale">Precio al Mayor Rebajado</Label>
                    <Input id="priceWholesaleSale" type="number" step="0.01" {...register('priceWholesaleSale')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wholesaleDiscountEnd">Fin de rebaja al mayor</Label>
                    <Input id="wholesaleDiscountEnd" type="datetime-local" {...register('wholesaleDiscountEnd')} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Features */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold">Características</h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="Agregar característica..."
                    value={featureInput}
                    onChange={e => setFeatureInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                  />
                  <Button type="button" variant="outline" onClick={addFeature}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {features.map((f, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {f}
                      <button type="button" onClick={() => removeFeature(i)} className="ml-1 hover:text-red-500">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Care Instructions */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold">Instrucciones de Cuidado</h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="Agregar instrucción..."
                    value={careInput}
                    onChange={e => setCareInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCare())}
                  />
                  <Button type="button" variant="outline" onClick={addCare}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {careInstructions.map((c, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {c}
                      <button type="button" onClick={() => removeCare(i)} className="ml-1 hover:text-red-500">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Styles */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold">Estilos</h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="Agregar estilo..."
                    value={styleInput}
                    onChange={e => setStyleInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addStyle())}
                  />
                  <Button type="button" variant="outline" onClick={addStyle}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {styles.map((s, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {s}
                      <button type="button" onClick={() => removeStyle(i)} className="ml-1 hover:text-red-500">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── TAB VARIANTES ─── */}
          <TabsContent value="variants" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Variantes del Producto</h3>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  appendVariant({
                    colorId: '',
                    size: 'M',
                    fit: '',
                    sku: '',
                    status: 'AVAILABLE',
                    stock: 0,
                    minStock: 5,
                  })
                }
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar Variante
              </Button>
            </div>

            {variantFields.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  No hay variantes. Agrega al menos una variante (color + talla + SKU).
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {variantFields.map((field, index) => (
                  <Card key={field.id}>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
                        <div className="space-y-1">
                          <Label className="text-xs">Color *</Label>
                          <Controller
                            name={`variants.${index}.colorId`}
                            control={control}
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className="text-xs">
                                  <SelectValue placeholder="Color" />
                                </SelectTrigger>
                                <SelectContent>
                                  {colors.map(c => (
                                    <SelectItem key={c.id} value={c.id}>
                                      <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: c.hex }} />
                                        {c.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Talla *</Label>
                          <Controller
                            name={`variants.${index}.size`}
                            control={control}
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className="text-xs">
                                  <SelectValue placeholder="Talla" />
                                </SelectTrigger>
                                <SelectContent>
                                  {SIZES.map(s => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Fit</Label>
                          <Controller
                            name={`variants.${index}.fit`}
                            control={control}
                            render={({ field }) => (
                              <Select value={field.value || SELECT_EMPTY_VALUE} onValueChange={(value) => field.onChange(value === SELECT_EMPTY_VALUE ? '' : value)}>
                                <SelectTrigger className="text-xs">
                                  <SelectValue placeholder="Fit" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={SELECT_EMPTY_VALUE}>—</SelectItem>
                                  {FITS.map(f => (
                                    <SelectItem key={f} value={f}>{f}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">SKU *</Label>
                          <Input className="text-xs" {...register(`variants.${index}.sku`)} placeholder="SKU" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Estado</Label>
                          <Controller
                            name={`variants.${index}.status`}
                            control={control}
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className="text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUSES.map(s => (
                                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Stock</Label>
                          <Input className="text-xs" type="number" {...register(`variants.${index}.stock`)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Stock Mín.</Label>
                          <Input className="text-xs" type="number" {...register(`variants.${index}.minStock`)} />
                        </div>
                        <div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeVariant(index)}
                            className="text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── TAB MEDIOS (fotos y videos) ─── */}
          <TabsContent value="images" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Medios del Producto</h3>
                <p className="text-xs text-gray-500">
                  El primer medio (orden 0) es la portada. Si es un video, se reproduce mudo y en loop en tarjetas/catálogo dentro de su ventana de vista previa configurada en la Media Library.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => setPickerTargetIndex('append')}>
                <ImageIcon className="w-4 h-4 mr-2" />
                Agregar desde Media Library
              </Button>
            </div>

            {imageFields.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  No hay medios. Agrega fotos o videos desde la Media Library.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {imageFields.map((field, index) => (
                  <Card key={field.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="relative w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          {watch(`images.${index}.storageKey`) ? (
                            <MediaThumb
                              storageKey={watch(`images.${index}.storageKey`)!}
                              mimeType={watch(`images.${index}.mimeType`) ?? ''}
                              sizes="80px"
                            />
                          ) : (
                            <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">Sin medio</span>
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => setPickerTargetIndex(index)}>
                            <ImageIcon className="w-3.5 h-3.5 mr-2" />
                            {watch(`images.${index}.url`) ? 'Cambiar medio' : 'Elegir medio'}
                          </Button>
                          <div>
                            <Label className="text-xs">Alt</Label>
                            <Input className="text-xs" {...register(`images.${index}.alt`)} placeholder="Texto alternativo" />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <Label className="text-xs">Color asociado</Label>
                          <Controller
                            name={`images.${index}.colorId`}
                            control={control}
                            render={({ field }) => (
                              <Select value={field.value || SELECT_EMPTY_VALUE} onValueChange={(value) => field.onChange(value === SELECT_EMPTY_VALUE ? '' : value)}>
                                <SelectTrigger className="text-xs">
                                  <SelectValue placeholder="Sin color específico" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={SELECT_EMPTY_VALUE}>Sin color específico</SelectItem>
                                  {colors.map(c => (
                                    <SelectItem key={c.id} value={c.id}>
                                      <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: c.hex }} />
                                        {c.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Orden</Label>
                          <Input className="text-xs w-16" type="number" {...register(`images.${index}.sortOrder`)} />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeImage(index)}
                          className="text-red-500 mt-5"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </form>

      <MediaPicker
        open={pickerTargetIndex !== null}
        onClose={() => setPickerTargetIndex(null)}
        folder="PRODUCTS"
        segments={slugValue ? [slugValue] : []}
        multiple={pickerTargetIndex === 'append'}
        onConfirm={(assets) => {
          if (pickerTargetIndex === 'append') {
            assets.forEach((asset, i) => {
              appendImage({
                assetId: asset.id,
                colorId: '',
                url: resolveMediaUrl(asset.storageKey),
                storageKey: asset.storageKey,
                mimeType: asset.mimeType,
                alt: asset.altText ?? '',
                sortOrder: imageFields.length + i,
              });
            });
          } else if (typeof pickerTargetIndex === 'number' && assets[0]) {
            setValue(`images.${pickerTargetIndex}.assetId`, assets[0].id);
            setValue(`images.${pickerTargetIndex}.url`, resolveMediaUrl(assets[0].storageKey));
            setValue(`images.${pickerTargetIndex}.storageKey`, assets[0].storageKey);
            setValue(`images.${pickerTargetIndex}.mimeType`, assets[0].mimeType);
            if (!watch(`images.${pickerTargetIndex}.alt`)) {
              setValue(`images.${pickerTargetIndex}.alt`, assets[0].altText ?? '');
            }
          }
          setPickerTargetIndex(null);
        }}
      />
    </div>
  );
}
