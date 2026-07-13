'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { ArrowLeft, Save, Plus, Trash2, AlertTriangle, ImageIcon, Pencil, ChevronsUpDown } from 'lucide-react';
import Link from 'next/link';
import { MediaPicker } from '@/components/admin/media/MediaPicker';
import { resolveMediaUrl } from '@/lib/media';
import { cn } from '@/lib/utils';
import ProductForm from '@/components/admin/ProductForm';
import { RuleForm } from '@/components/admin/RuleForm';
import { RULE_TYPE_LABELS, type RuleTypeKey } from '@/lib/rule-config-schemas';

const SetItemSchema = z.object({
  productId: z.string().min(1, 'Producto requerido'),
  quantityPerSet: z.coerce.number().min(1, 'Cantidad mínima 1'),
});

const SetFormSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  slug: z.string().min(1, 'Slug requerido'),
  description: z.string().optional(),
  coverAssetId: z.string().optional(),
  imageUrl: z.string().optional(), // solo para previsualización, no se persiste
  setGroupId: z.string().optional(),
  brandId: z.string().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  priceManual: z.string().optional(),
  priceManualSale: z.string().optional(),
  manualDiscountEnd: z.string().optional(),
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
  visibility: 'INDIVIDUAL' | 'GROUPS' | 'BOTH';
  brandName: string | null;
  imageUrl: string | null;
  colors: { id: string; name: string; hex: string }[];
  sizes: string[];
  hasActiveVariant: boolean;
}

interface SetRuleRow {
  id: string;
  name: string;
  ruleType: RuleTypeKey;
  scope: 'GLOBAL' | 'BRAND' | 'SET_GROUP' | 'SET' | 'PRODUCT';
  scopeId: string | null;
  isActive: boolean;
  priority: number;
  isWinner: boolean;
}

interface SetFormProps {
  setId?: string;
  initialData?: SetFormData;
}

const SELECT_EMPTY_VALUE = '__empty__';

/** Precio efectivo de una pieza: rebajado al mayor si existe, si no el precio al mayor normal. */
function productPrice(p: EligibleProduct | undefined): number | null {
  if (!p) return null;
  if (p.priceWholesaleSale) return Number(p.priceWholesaleSale);
  if (p.priceWholesale) return Number(p.priceWholesale);
  return null;
}

export default function SetForm({ setId, initialData }: SetFormProps) {
  const router = useRouter();
  const [groups, setGroups] = useState<SetGroup[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<EligibleProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pieceComboOpen, setPieceComboOpen] = useState<number | null>(null);

  // Drawer de producto (crear pieza nueva / editar pieza existente sin salir del set)
  const [productDrawer, setProductDrawer] = useState<{ productId?: string; targetIndex: number } | null>(null);

  // Sección "Reglas de este set" (solo edición)
  const [setRules, setSetRules] = useState<SetRuleRow[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [ruleDrawer, setRuleDrawer] = useState<{ ruleId?: string } | null>(null);

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

  const [manualPriceEnabled, setManualPriceEnabled] = useState(Boolean(initialData?.priceManual));

  const fetchProducts = useCallback(async () => {
    const res = await fetch('/api/admin/products/eligible-for-sets');
    if (res.ok) setProducts((await res.json()).products || []);
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [groupsRes, brandsRes] = await Promise.all([
          fetch('/api/admin/set-groups'),
          fetch('/api/admin/brands?limit=1000'),
        ]);
        if (groupsRes.ok) setGroups((await groupsRes.json()).groups || []);
        if (brandsRes.ok) setBrands((await brandsRes.json()).brands || []);
        await fetchProducts();
      } catch {
        toast.error('Error al cargar datos de referencia');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [fetchProducts]);

  const refreshSetRules = useCallback(async () => {
    if (!setId) return;
    setRulesLoading(true);
    try {
      const res = await fetch(`/api/admin/sets/${setId}/rules`);
      if (res.ok) setSetRules((await res.json()).rules || []);
    } finally {
      setRulesLoading(false);
    }
  }, [setId]);

  useEffect(() => {
    refreshSetRules();
  }, [refreshSetRules]);

  const nameValue = watch('name');
  const slugValue = watch('slug');
  useEffect(() => {
    if (!setId && nameValue && !slugValue) {
      setValue('slug', nameValue.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  }, [nameValue, slugValue, setId, setValue]);

  // ── Vista previa de precio referencial (suma de precios al mayor × cantidad) ──
  const pricePreview = items.reduce(
    (acc, item) => {
      const price = productPrice(products.find((p) => p.id === item.productId));
      if (price === null) {
        acc.hasMissing = true;
        return acc;
      }
      acc.total += price * (item.quantityPerSet || 1);
      return acc;
    },
    { total: 0, hasMissing: false }
  );

  const priceManualValue = watch('priceManual');
  const priceManualNumber = priceManualValue ? Number(priceManualValue) : null;
  const deltaPct = priceManualNumber && pricePreview.total > 0
    ? Math.round(((priceManualNumber - pricePreview.total) / pricePreview.total) * 100)
    : null;

  async function onSubmit(data: SetFormData) {
    setSaving(true);
    try {
      const payload = {
        ...data,
        setGroupId: data.setGroupId || null,
        brandId: data.brandId || null,
        priceManual: manualPriceEnabled ? (data.priceManual || null) : null,
        priceManualSale: manualPriceEnabled ? (data.priceManualSale || null) : null,
        manualDiscountEnd: manualPriceEnabled ? (data.manualDiscountEnd || null) : null,
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

  const rulesByType = useMemo(() => {
    const map = new Map<RuleTypeKey, SetRuleRow[]>();
    for (const r of setRules) {
      const list = map.get(r.ruleType) ?? [];
      list.push(r);
      map.set(r.ruleType, list);
    }
    return map;
  }, [setRules]);

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
                <Label>Imagen de portada</Label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-12 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                    {watch('imageUrl') ? (
                      <img src={watch('imageUrl')} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-gray-300" />
                    )}
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
                    {watch('imageUrl') ? 'Cambiar' : 'Elegir imagen'}
                  </Button>
                </div>
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
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    append({ productId: '', quantityPerSet: 1 });
                    setProductDrawer({ targetIndex: fields.length });
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear producto nuevo
                </Button>
                <Button type="button" variant="outline" onClick={() => append({ productId: '', quantityPerSet: 1 })}>
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar pieza
                </Button>
              </div>
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
                  const product = products.find((p) => p.id === productId);
                  const price = productPrice(product);
                  const warnings: string[] = [];
                  if (product) {
                    if (product.visibility === 'INDIVIDUAL') {
                      warnings.push('Visibilidad "Solo Individual" — no aparecerá en ningún set corporativo hasta que la cambies.');
                    }
                    if (price === null) {
                      warnings.push('Sin precio al mayor asignado — no aporta al precio automático del set.');
                    }
                    if (!product.hasActiveVariant) {
                      warnings.push('Sin variantes activas — no tiene stock disponible en ningún color/talla.');
                    }
                  }
                  return (
                    <div key={field.id} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-end gap-3">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          {product?.imageUrl ? (
                            <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                              <ImageIcon className="w-4 h-4" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Producto *</Label>
                          <Controller
                            name={`items.${index}.productId`}
                            control={control}
                            render={({ field: selectField }) => (
                              <Popover open={pieceComboOpen === index} onOpenChange={(open) => setPieceComboOpen(open ? index : null)}>
                                <PopoverTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    role="combobox"
                                    className="w-full justify-between font-normal"
                                  >
                                    {product ? `${product.name}${product.brandName ? ` (${product.brandName})` : ''}` : 'Buscar producto...'}
                                    <ChevronsUpDown className="w-4 h-4 opacity-50 ml-2 flex-shrink-0" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[420px] p-0" align="start">
                                  <Command>
                                    <CommandInput placeholder="Buscar por nombre o marca..." />
                                    <CommandList>
                                      <CommandEmpty>Sin resultados.</CommandEmpty>
                                      <CommandGroup>
                                        {products.map((p) => (
                                          <CommandItem
                                            key={p.id}
                                            value={`${p.name} ${p.brandName ?? ''}`}
                                            onSelect={() => {
                                              selectField.onChange(p.id);
                                              setPieceComboOpen(null);
                                            }}
                                          >
                                            <div className="w-8 h-8 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                                              {p.imageUrl ? (
                                                <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                                              ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                  <ImageIcon className="w-3 h-3" />
                                                </div>
                                              )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm truncate">{p.name}</p>
                                              <p className="text-xs text-gray-400 truncate">
                                                {p.brandName ?? 'Sin marca'} · {productPrice(p) !== null ? `$${productPrice(p)!.toFixed(2)}` : 'Sin precio'}
                                              </p>
                                            </div>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            )}
                          />
                        </div>

                        <div className="w-28 space-y-1">
                          <Label className="text-xs">Cantidad por set</Label>
                          <Input type="number" min={1} {...register(`items.${index}.quantityPerSet`)} />
                        </div>

                        <div className="w-24 text-sm text-right">
                          {productId && (
                            price !== null ? (
                              <span className="text-gray-600">${price.toFixed(2)}</span>
                            ) : (
                              <span className="flex items-center gap-1 text-amber-600 text-xs justify-end">
                                <AlertTriangle className="w-3 h-3" /> Sin precio
                              </span>
                            )
                          )}
                        </div>

                        {productId && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setProductDrawer({ productId, targetIndex: index })}
                            title="Editar producto"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} className="text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {product && (product.colors.length > 0 || product.sizes.length > 0) && (
                        <div className="flex items-center gap-3 pl-16 text-xs text-gray-500">
                          {product.colors.length > 0 && (
                            <div className="flex items-center gap-1">
                              {product.colors.map((c) => (
                                <span
                                  key={c.id}
                                  className="w-3 h-3 rounded-full border border-gray-300"
                                  style={{ backgroundColor: c.hex }}
                                  title={c.name}
                                />
                              ))}
                            </div>
                          )}
                          {product.sizes.length > 0 && <span>Tallas: {product.sizes.join(', ')}</span>}
                        </div>
                      )}

                      {warnings.length > 0 && (
                        <div className="pl-16 space-y-1">
                          {warnings.map((w, i) => (
                            <p key={i} className="flex items-center gap-1.5 text-xs text-amber-600">
                              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                              {w}
                              <button
                                type="button"
                                className="underline hover:no-underline"
                                onClick={() => setProductDrawer({ productId, targetIndex: index })}
                              >
                                Completar en la ficha
                              </button>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Vista previa de precio referencial ── */}
            {fields.length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Precio referencial del set (suma automática)</span>
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

        {/* ── Precio del set (híbrido) ── */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Precio del set</h3>
                <p className="text-xs text-gray-500">
                  Por defecto el precio es automático (suma de piezas de arriba). Actívalo para fijar un precio propio del set.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={manualPriceEnabled} onCheckedChange={setManualPriceEnabled} />
                <Label>Fijar precio manual del set</Label>
              </div>
            </div>

            {manualPriceEnabled && (
              <div className="space-y-3 pt-2 border-t border-[#E5E5E5]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priceManual">Precio manual</Label>
                    <Input id="priceManual" type="number" step="0.01" {...register('priceManual')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priceManualSale">Precio manual rebajado</Label>
                    <Input id="priceManualSale" type="number" step="0.01" {...register('priceManualSale')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manualDiscountEnd">Fin de la rebaja</Label>
                    <Input id="manualDiscountEnd" type="datetime-local" {...register('manualDiscountEnd')} />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                  <span className="text-gray-500">Suma automática de piezas (referencia)</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">${pricePreview.total.toFixed(2)}</span>
                    {deltaPct !== null && (
                      <Badge variant={deltaPct < 0 ? 'default' : 'secondary'}>
                        {deltaPct > 0 ? '+' : ''}{deltaPct}% vs. suma de piezas
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Reglas de este set ── */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Reglas de este set</h3>
                <p className="text-xs text-gray-500">
                  Reglas de ámbito Set de este set, más las heredadas (Global, Marca, Grupo de Sets y Producto de sus piezas).
                </p>
              </div>
              {setId && (
                <Button type="button" variant="outline" onClick={() => setRuleDrawer({})}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva regla para este set
                </Button>
              )}
            </div>

            {!setId ? (
              <p className="text-sm text-gray-500 py-6 text-center bg-gray-50 rounded-lg">
                Guarda el set para gestionar sus reglas.
              </p>
            ) : rulesLoading ? (
              <p className="text-sm text-gray-500 py-6 text-center">Cargando reglas...</p>
            ) : setRules.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center bg-gray-50 rounded-lg">
                No hay reglas de negocio que afecten a este set todavía.
              </p>
            ) : (
              <div className="space-y-4">
                {Array.from(rulesByType.entries()).map(([ruleType, rules]) => (
                  <div key={ruleType}>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      {RULE_TYPE_LABELS[ruleType] ?? ruleType}
                    </h4>
                    <div className="space-y-1.5">
                      {rules.map((r) => (
                        <div
                          key={r.id}
                          className={cn(
                            'flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-sm',
                            r.isWinner ? 'border-[#111111] bg-[#F5F5F7]' : 'border-[#E5E5E5]'
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant={r.scope === 'SET' ? 'default' : 'secondary'}>{r.scope}</Badge>
                            <span className="truncate">{r.name}</span>
                            {!r.isActive && <Badge variant="outline" className="text-gray-400">Inactiva</Badge>}
                            {r.isWinner && <Badge className="bg-[#34C759]">Ganadora</Badge>}
                          </div>
                          {r.scope === 'SET' ? (
                            <Button type="button" variant="ghost" size="sm" onClick={() => setRuleDrawer({ ruleId: r.id })}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          ) : (
                            <Link href={`/admin/reglas/${r.id}`} className="text-xs text-gray-400 hover:text-[#111111] flex-shrink-0">
                              Ver en panel de reglas
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </form>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        folder="SETS"
        segments={slugValue ? [slugValue] : []}
        onConfirm={(assets) => {
          if (assets[0]) {
            setValue('coverAssetId', assets[0].id);
            setValue('imageUrl', resolveMediaUrl(assets[0].storageKey));
          }
          setPickerOpen(false);
        }}
      />

      {/* ── Drawer: crear/editar producto sin salir del set ── */}
      <Sheet open={productDrawer !== null} onOpenChange={(open) => !open && setProductDrawer(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[90vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="sr-only">
              {productDrawer?.productId ? 'Editar producto' : 'Nuevo producto'}
            </SheetTitle>
          </SheetHeader>
          {productDrawer && (
            <ProductForm
              embedded
              productId={productDrawer.productId}
              initialVisibility="GROUPS"
              onCancel={() => setProductDrawer(null)}
              onSaved={async (saved) => {
                await fetchProducts();
                setValue(`items.${productDrawer.targetIndex}.productId`, saved.id);
                setProductDrawer(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* ── Drawer: crear/editar regla de ámbito Set sin salir del set ── */}
      <Sheet open={ruleDrawer !== null} onOpenChange={(open) => !open && setRuleDrawer(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[90vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="sr-only">{ruleDrawer?.ruleId ? 'Editar regla' : 'Nueva regla del set'}</SheetTitle>
          </SheetHeader>
          {ruleDrawer && setId && (
            <RuleDrawerContent
              ruleId={ruleDrawer.ruleId}
              setId={setId}
              onCancel={() => setRuleDrawer(null)}
              onSaved={async () => {
                setRuleDrawer(null);
                await refreshSetRules();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Carga los datos de una regla existente (si `ruleId`) antes de montar `RuleForm` embebido —
 * el drawer del ensamblador no tiene una página server-side que resuelva esto de antemano. */
function RuleDrawerContent({
  ruleId,
  setId,
  onCancel,
  onSaved,
}: {
  ruleId?: string;
  setId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [initial, setInitial] = useState<Parameters<typeof RuleForm>[0]['initial'] | undefined>(undefined);
  const [loading, setLoading] = useState(Boolean(ruleId));

  useEffect(() => {
    if (!ruleId) return;
    fetch(`/api/admin/rules/${ruleId}`)
      .then((r) => r.json())
      .then((rule) => setInitial({
        name: rule.name,
        ruleType: rule.ruleType,
        scope: rule.scope,
        scopeId: rule.scopeId,
        config: rule.config,
        isActive: rule.isActive ?? true,
        priority: rule.priority ?? 0,
      }))
      .finally(() => setLoading(false));
  }, [ruleId]);

  if (loading) return <p className="text-sm text-gray-500 p-4">Cargando regla...</p>;

  return (
    <div className="p-4">
      <RuleForm
        mode={ruleId ? 'edit' : 'create'}
        ruleId={ruleId}
        initial={initial}
        embedded
        lockedScope={{ scope: 'SET', scopeId: setId }}
        onCancel={onCancel}
        onSaved={onSaved}
      />
    </div>
  );
}
