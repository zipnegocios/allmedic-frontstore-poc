'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import { ArrowLeft, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { MediaPicker } from '@/components/admin/media/MediaPicker';
import { resolveMediaUrl } from '@/lib/media';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  ProductFormSchema,
  type ProductFormData,
  type Brand,
  type Color,
  CATEGORIES,
  GENDERS,
  VISIBILITY_OPTIONS,
} from '@/components/admin/product-form/schema';
import {
  PRODUCT_FORM_WIZARD_STEPS,
  getStepProgressLabel,
  canNavigateToStep,
  nextMaxVisitedIndex,
} from '@/components/admin/product-form/wizard-steps';
import { TagListEditor } from '@/components/admin/product-form/TagListEditor';
import { VariantsSection } from '@/components/admin/product-form/VariantsSection';
import { MediaSection } from '@/components/admin/product-form/MediaSection';

// ─── Component ───

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

export default function ProductForm({
  productId,
  initialData,
  embedded = false,
  initialVisibility,
  onSaved,
  onCancel,
}: ProductFormProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [featureInput, setFeatureInput] = useState('');
  const [careInput, setCareInput] = useState('');
  const [styleInput, setStyleInput] = useState('');
  const [pickerTargetIndex, setPickerTargetIndex] = useState<number | 'append' | null>(null);

  // ─── Wizard mobile: paso actual y pasos ya visitados ───
  // Solo tiene efecto cuando `isMobile` es true; en desktop se ignora por
  // completo (se renderiza siempre el `Tabs` de siempre).
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [maxVisitedStepIndex, setMaxVisitedStepIndex] = useState(0);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    trigger,
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
      router.push('/admin/productos');
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

  // ─── Navegación del wizard mobile ───

  const totalSteps = PRODUCT_FORM_WIZARD_STEPS.length;
  const currentStep = PRODUCT_FORM_WIZARD_STEPS[currentStepIndex];
  const isLastWizardStep = currentStepIndex === totalSteps - 1;

  function goToStep(index: number) {
    if (!canNavigateToStep(index, maxVisitedStepIndex)) return;
    setCurrentStepIndex(index);
  }

  async function goToNextStep() {
    const fields = currentStep.fields;
    const valid = fields.length === 0 ? true : await trigger(fields as (keyof ProductFormData)[]);
    if (!valid) return;
    const next = Math.min(currentStepIndex + 1, totalSteps - 1);
    setCurrentStepIndex(next);
    setMaxVisitedStepIndex((m) => nextMaxVisitedIndex(m, next));
  }

  function goToPreviousStep() {
    setCurrentStepIndex((i) => Math.max(0, i - 1));
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  const mediaPickerDialog = (
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
  );

  return (
    <div className={embedded ? '' : 'p-4 md:p-8 max-w-5xl'}>
      <div className="flex items-center justify-between mb-8">
        {embedded ? (
          <h2 className="text-xl font-bold text-[#111111]">
            {productId ? 'Editar producto' : 'Nuevo producto'}
          </h2>
        ) : (
          <div className="flex items-center gap-4">
            <Link href="/admin/productos">
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
        {isMobile ? (
          <div className="space-y-4">
            {/* ─── Indicador de progreso ─── */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">
                {getStepProgressLabel(currentStepIndex)}
              </p>
              <div className="flex gap-1.5" role="tablist" aria-label="Pasos del formulario">
                {PRODUCT_FORM_WIZARD_STEPS.map((step, index) => {
                  const isVisited = canNavigateToStep(index, maxVisitedStepIndex);
                  const isCurrent = index === currentStepIndex;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      role="tab"
                      aria-selected={isCurrent}
                      aria-label={`Paso ${index + 1}: ${step.label}`}
                      disabled={!isVisited}
                      onClick={() => goToStep(index)}
                      className={cn(
                        'min-h-11 flex-1 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]',
                        isCurrent ? 'bg-[#111111]' : isVisited ? 'bg-gray-400' : 'bg-gray-200',
                        !isVisited && 'cursor-not-allowed'
                      )}
                    />
                  );
                })}
              </div>
            </div>

            {/* ─── Contenido del paso actual ─── */}
            <div className="motion-reduce:transition-none transition-opacity">
              {currentStep.id === 'identification' && (
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="m-name">Nombre *</Label>
                      <Input id="m-name" {...register('name')} />
                      {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="m-slug">Slug *</Label>
                      <Input id="m-slug" {...register('slug')} />
                      {errors.slug && <p className="text-sm text-red-500">{errors.slug.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="m-sku">SKU</Label>
                      <Input id="m-sku" {...register('sku')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="m-brandId">Marca *</Label>
                      <Controller
                        name="brandId"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger id="m-brandId">
                              <SelectValue placeholder="Seleccionar marca" />
                            </SelectTrigger>
                            <SelectContent>
                              {brands.map(b => (
                                <SelectItem key={b.id} value={b.id} disabled={!b.isActive}>
                                  {b.name}{!b.isActive ? ' (Inactiva)' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.brandId && <p className="text-sm text-red-500">{errors.brandId.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="m-category">Categoría *</Label>
                      <Controller
                        name="category"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger id="m-category">
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
                    <div className="space-y-2">
                      <Label htmlFor="m-gender">Género *</Label>
                      <Controller
                        name="gender"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger id="m-gender">
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
                      <Label htmlFor="m-productType">Tipo de Producto</Label>
                      <Input id="m-productType" {...register('productType')} placeholder="Ej: Scrub, Bata..." />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="m-description">Descripción</Label>
                      <Textarea id="m-description" {...register('description')} rows={4} />
                    </div>
                  </CardContent>
                </Card>
              )}

              {currentStep.id === 'pricing' && (
                <div className="space-y-4">
                  <Card>
                    <CardContent className="p-6 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="m-priceNormal">Precio Normal *</Label>
                        <Input id="m-priceNormal" type="number" step="0.01" inputMode="decimal" {...register('priceNormal')} />
                        {errors.priceNormal && <p className="text-sm text-red-500">{errors.priceNormal.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="m-priceSale">Precio Oferta</Label>
                        <Input id="m-priceSale" type="number" step="0.01" inputMode="decimal" {...register('priceSale')} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="m-discountPct">% Descuento</Label>
                        <Input id="m-discountPct" type="number" min={0} max={100} inputMode="numeric" {...register('discountPct')} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="m-discountEnd">Fin de descuento</Label>
                        <Input id="m-discountEnd" type="datetime-local" {...register('discountEnd')} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="m-visibility">Visibilidad *</Label>
                        <Controller
                          name="visibility"
                          control={control}
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger id="m-visibility">
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
                      <div className="space-y-3 pt-2">
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

                  <Card>
                    <CardContent className="p-6 space-y-4">
                      <div>
                        <h3 className="font-semibold">Precios al Mayor</h3>
                        <p className="text-xs text-gray-500">
                          Usados para calcular el precio referencial de sets corporativos. Opcionales si el producto es &quot;Solo Individual&quot;.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="m-priceWholesale">Precio al Mayor</Label>
                        <Input id="m-priceWholesale" type="number" step="0.01" inputMode="decimal" {...register('priceWholesale')} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="m-priceWholesaleSale">Precio al Mayor Rebajado</Label>
                        <Input id="m-priceWholesaleSale" type="number" step="0.01" inputMode="decimal" {...register('priceWholesaleSale')} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="m-wholesaleDiscountEnd">Fin de rebaja al mayor</Label>
                        <Input id="m-wholesaleDiscountEnd" type="datetime-local" {...register('wholesaleDiscountEnd')} />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {currentStep.id === 'content' && (
                <Card>
                  <CardContent className="p-2">
                    <Accordion type="multiple" defaultValue={['features']} className="w-full">
                      <AccordionItem value="features">
                        <AccordionTrigger className="px-4">
                          Características
                          {features.length > 0 && (
                            <Badge variant="secondary" className="ml-2">{features.length}</Badge>
                          )}
                        </AccordionTrigger>
                        <AccordionContent className="px-4">
                          <TagListEditor
                            placeholder="Agregar característica..."
                            values={features}
                            inputValue={featureInput}
                            onInputChange={setFeatureInput}
                            onAdd={addFeature}
                            onRemove={removeFeature}
                          />
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="care">
                        <AccordionTrigger className="px-4">
                          Instrucciones de Cuidado
                          {careInstructions.length > 0 && (
                            <Badge variant="secondary" className="ml-2">{careInstructions.length}</Badge>
                          )}
                        </AccordionTrigger>
                        <AccordionContent className="px-4">
                          <TagListEditor
                            placeholder="Agregar instrucción..."
                            values={careInstructions}
                            inputValue={careInput}
                            onInputChange={setCareInput}
                            onAdd={addCare}
                            onRemove={removeCare}
                          />
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="styles">
                        <AccordionTrigger className="px-4">
                          Estilos
                          {styles.length > 0 && (
                            <Badge variant="secondary" className="ml-2">{styles.length}</Badge>
                          )}
                        </AccordionTrigger>
                        <AccordionContent className="px-4">
                          <TagListEditor
                            placeholder="Agregar estilo..."
                            values={styles}
                            inputValue={styleInput}
                            onInputChange={setStyleInput}
                            onAdd={addStyle}
                            onRemove={removeStyle}
                          />
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                </Card>
              )}

              {currentStep.id === 'variants' && (
                <VariantsSection
                  control={control}
                  register={register}
                  colors={colors}
                  variantFields={variantFields}
                  appendVariant={appendVariant}
                  removeVariant={removeVariant}
                />
              )}

              {currentStep.id === 'media' && (
                <MediaSection
                  control={control}
                  register={register}
                  watch={watch}
                  colors={colors}
                  imageFields={imageFields}
                  removeImage={removeImage}
                  onPickTarget={setPickerTargetIndex}
                />
              )}
            </div>

            {/* ─── Barra sticky inferior: navegación del wizard + Guardar/Cancelar ─── */}
            <div
              className={cn(
                'sticky z-10 flex items-center justify-between gap-2 border-t bg-white/95 backdrop-blur px-4 py-3',
                !embedded && '-mx-4',
                embedded
                  ? 'bottom-0 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))]'
                  : 'bottom-[calc(5rem_+_env(safe-area-inset-bottom))]'
              )}
            >
              <div className="flex items-center gap-2">
                {embedded && (
                  <Button type="button" variant="outline" onClick={() => onCancel?.()} className="min-h-11">
                    Cancelar
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={goToPreviousStep}
                  disabled={currentStepIndex === 0}
                  className="min-h-11 min-w-11"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Atrás
                </Button>
              </div>
              {isLastWizardStep ? (
                <Button
                  type="button"
                  onClick={() => handleSubmit(onSubmit)()}
                  disabled={saving}
                  className="min-h-11 bg-[#111111]"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
              ) : (
                <Button type="button" onClick={goToNextStep} className="min-h-11 bg-[#111111]">
                  Siguiente
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        ) : (
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
                                <SelectItem key={b.id} value={b.id} disabled={!b.isActive}>
                                  {b.name}{!b.isActive ? ' (Inactiva)' : ''}
                                </SelectItem>
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
                      <Input id="priceNormal" type="number" step="0.01" inputMode="decimal" {...register('priceNormal')} />
                      {errors.priceNormal && <p className="text-sm text-red-500">{errors.priceNormal.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priceSale">Precio Oferta</Label>
                      <Input id="priceSale" type="number" step="0.01" inputMode="decimal" {...register('priceSale')} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="discountPct">% Descuento</Label>
                      <Input id="discountPct" type="number" min={0} max={100} inputMode="numeric" {...register('discountPct')} />
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
                      <Input id="priceWholesale" type="number" step="0.01" inputMode="decimal" {...register('priceWholesale')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priceWholesaleSale">Precio al Mayor Rebajado</Label>
                      <Input id="priceWholesaleSale" type="number" step="0.01" inputMode="decimal" {...register('priceWholesaleSale')} />
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
                  <TagListEditor
                    title="Características"
                    placeholder="Agregar característica..."
                    values={features}
                    inputValue={featureInput}
                    onInputChange={setFeatureInput}
                    onAdd={addFeature}
                    onRemove={removeFeature}
                  />
                </CardContent>
              </Card>

              {/* Care Instructions */}
              <Card>
                <CardContent className="p-6 space-y-4">
                  <TagListEditor
                    title="Instrucciones de Cuidado"
                    placeholder="Agregar instrucción..."
                    values={careInstructions}
                    inputValue={careInput}
                    onInputChange={setCareInput}
                    onAdd={addCare}
                    onRemove={removeCare}
                  />
                </CardContent>
              </Card>

              {/* Styles */}
              <Card>
                <CardContent className="p-6 space-y-4">
                  <TagListEditor
                    title="Estilos"
                    placeholder="Agregar estilo..."
                    values={styles}
                    inputValue={styleInput}
                    onInputChange={setStyleInput}
                    onAdd={addStyle}
                    onRemove={removeStyle}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ─── TAB VARIANTES ─── */}
            <TabsContent value="variants" className="space-y-4">
              <VariantsSection
                control={control}
                register={register}
                colors={colors}
                variantFields={variantFields}
                appendVariant={appendVariant}
                removeVariant={removeVariant}
              />
            </TabsContent>

            {/* ─── TAB MEDIOS (fotos y videos) ─── */}
            <TabsContent value="images" className="space-y-4">
              <MediaSection
                control={control}
                register={register}
                watch={watch}
                colors={colors}
                imageFields={imageFields}
                removeImage={removeImage}
                onPickTarget={setPickerTargetIndex}
              />
            </TabsContent>
          </Tabs>
        )}
      </form>

      {mediaPickerDialog}
    </div>
  );
}
