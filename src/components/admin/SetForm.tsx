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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Save, Plus, Trash2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

const SetItemSchema = z.object({
  productId: z.string().min(1, 'Producto requerido'),
  quantityPerSet: z.coerce.number().min(1, 'Cantidad mínima 1'),
});

const SetFormSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  slug: z.string().min(1, 'Slug requerido'),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  setGroupId: z.string().optional(),
  brandId: z.string().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  items: z.array(SetItemSchema).min(1, 'Agrega al menos una pieza al set'),
});

type SetFormData = z.infer<typeof SetFormSchema>;

interface SetGroup {
  id: string;
  name: string;
}

interface Brand {
  id: string;
  name: string;
}

interface EligibleProduct {
  id: string;
  name: string;
  slug: string;
  priceWholesale: string | null;
  priceWholesaleSale: string | null;
  priceNormal: string;
  brandName: string | null;
}

interface SetFormProps {
  setId?: string;
  initialData?: SetFormData;
}

const SELECT_EMPTY_VALUE = '__empty__';

export default function SetForm({ setId, initialData }: SetFormProps) {
  const router = useRouter();
  const [groups, setGroups] = useState<SetGroup[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<EligibleProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SetFormData>({
    resolver: zodResolver(SetFormSchema) as never,
    defaultValues: initialData || {
      name: '',
      slug: '',
      description: '',
      imageUrl: '',
      isActive: true,
      isFeatured: false,
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [groupsRes, brandsRes, productsRes] = await Promise.all([
          fetch('/api/admin/set-groups'),
          fetch('/api/admin/brands?limit=1000'),
          fetch('/api/admin/products/eligible-for-sets'),
        ]);
        if (groupsRes.ok) setGroups((await groupsRes.json()).groups || []);
        if (brandsRes.ok) setBrands((await brandsRes.json()).brands || []);
        if (productsRes.ok) setProducts((await productsRes.json()).products || []);
      } catch {
        toast.error('Error al cargar datos de referencia');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const nameValue = watch('name');
  const slugValue = watch('slug');
  useEffect(() => {
    if (!setId && nameValue && !slugValue) {
      setValue('slug', nameValue.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  }, [nameValue, slugValue, setId, setValue]);

  // ── Vista previa de precio referencial (suma de precios al mayor × cantidad) ──
  function productPrice(productId: string): number | null {
    const p = products.find(p => p.id === productId);
    if (!p) return null;
    if (p.priceWholesaleSale) return Number(p.priceWholesaleSale);
    if (p.priceWholesale) return Number(p.priceWholesale);
    return null;
  }

  const pricePreview = items.reduce(
    (acc, item) => {
      const price = productPrice(item.productId);
      if (price === null) {
        acc.hasMissing = true;
        return acc;
      }
      acc.total += price * (item.quantityPerSet || 1);
      return acc;
    },
    { total: 0, hasMissing: false }
  );

  async function onSubmit(data: SetFormData) {
    setSaving(true);
    try {
      const payload = {
        ...data,
        setGroupId: data.setGroupId || null,
        brandId: data.brandId || null,
        items: data.items.map((item, idx) => ({ ...item, sortOrder: idx })),
      };
      const url = setId ? `/api/admin/sets/${setId}` : '/api/admin/sets';
      const method = setId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al guardar');
      }
      toast.success(setId ? 'Set actualizado' : 'Set creado');
      router.push('/admin/sets');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/admin/sets">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-[#111111]">
            {setId ? 'Editar Set Corporativo' : 'Nuevo Set Corporativo'}
          </h1>
        </div>
        <Button onClick={() => handleSubmit(onSubmit)()} disabled={saving} className="bg-[#111111]">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(onSubmit)(); }} className="space-y-6">
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
              <Textarea id="description" {...register('description')} rows={3} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="imageUrl">URL de Imagen</Label>
                <Input id="imageUrl" {...register('imageUrl')} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Grupo de Sets</Label>
                <Controller
                  name="setGroupId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value || SELECT_EMPTY_VALUE} onValueChange={(v) => field.onChange(v === SELECT_EMPTY_VALUE ? '' : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sin grupo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_EMPTY_VALUE}>Sin grupo</SelectItem>
                        {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Marca (opcional)</Label>
                <Controller
                  name="brandId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value || SELECT_EMPTY_VALUE} onValueChange={(v) => field.onChange(v === SELECT_EMPTY_VALUE ? '' : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Multi-marca" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_EMPTY_VALUE}>Multi-marca</SelectItem>
                        {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="flex gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => <Checkbox checked={field.value} onCheckedChange={field.onChange} />}
                />
                <Label>Activo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Controller
                  name="isFeatured"
                  control={control}
                  render={({ field }) => <Checkbox checked={field.value} onCheckedChange={field.onChange} />}
                />
                <Label>Destacado</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Piezas del Set ── */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Piezas del Set</h3>
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ productId: '', quantityPerSet: 1 })}
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar Pieza
              </Button>
            </div>
            {errors.items && typeof errors.items.message === 'string' && (
              <p className="text-sm text-red-500">{errors.items.message}</p>
            )}

            {fields.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">
                No hay piezas agregadas. Agrega al menos una pieza (producto con visibilidad &quot;Solo Grupos&quot; o &quot;Ambos&quot;).
              </p>
            ) : (
              <div className="space-y-3">
                {fields.map((field, index) => {
                  const productId = items[index]?.productId;
                  const price = productId ? productPrice(productId) : null;
                  return (
                    <div key={field.id} className="flex items-end gap-3 p-3 border rounded-lg">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Producto *</Label>
                        <Controller
                          name={`items.${index}.productId`}
                          control={control}
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar producto" />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map(p => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} {p.brandName ? `(${p.brandName})` : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                      <div className="w-32 space-y-1">
                        <Label className="text-xs">Cantidad por set</Label>
                        <Input type="number" min={1} {...register(`items.${index}.quantityPerSet`)} />
                      </div>
                      <div className="w-28 text-sm">
                        {productId && (
                          price !== null ? (
                            <span className="text-gray-600">${price.toFixed(2)}</span>
                          ) : (
                            <span className="flex items-center gap-1 text-amber-600 text-xs">
                              <AlertTriangle className="w-3 h-3" /> Sin precio
                            </span>
                          )
                        )}
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} className="text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Vista previa de precio referencial ── */}
            {fields.length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Precio referencial del set</span>
                  <span className="text-2xl font-bold text-[#111111]">${pricePreview.total.toFixed(2)}</span>
                </div>
                {pricePreview.hasMissing && (
                  <Badge variant="destructive" className="mt-2 gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Una o más piezas no tienen precio al mayor asignado
                  </Badge>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Suma automática de precios al mayor (o rebajado al mayor si aplica) × cantidad por set.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
