'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Save, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
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
  type CollectionOption,
  type ProductTypeOption,
  GENDERS,
  VISIBILITY_OPTIONS,
} from '@/components/admin/product-form/schema';
import { buildValidationSummary } from '@/components/admin/product-form/validation-summary';
import {
  PRODUCT_FORM_WIZARD_STEPS,
  getStepProgressLabel,
  canNavigateToStep,
  nextMaxVisitedIndex,
} from '@/components/admin/product-form/wizard-steps';
import { TagListEditor } from '@/components/admin/product-form/TagListEditor';
import { VariantsMediaSection } from '@/components/admin/product-form/VariantsMediaSection';
import { FloatingSaveButton, type FloatingSaveStatus } from '@/components/admin/FloatingSaveButton';
import { AttributeStyleSection } from '@/components/admin/product-form/AttributeStyleSection';
import { useProductTypeAttributes } from '@/components/admin/product-form/useProductTypeAttributes';


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
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [productTypeOptions, setProductTypeOptions] = useState<ProductTypeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingStay, setSavingStay] = useState(false);
  // Estado visual del botón flotante "Guardar y quedarse" — vuelve a 'idle' solo
  // automáticamente 10s después de un resultado (ver efecto más abajo).
  const [saveStayStatus, setSaveStayStatus] = useState<FloatingSaveStatus>('idle');
  useEffect(() => {
    if (saveStayStatus !== 'success' && saveStayStatus !== 'error') return;
    const timer = setTimeout(() => setSaveStayStatus('idle'), 10000);
    return () => clearTimeout(timer);
  }, [saveStayStatus]);
  // Id real del producto en el servidor una vez creado — separado de la prop
  // `productId` (que sigue reflejando la URL/modo original) para que "Guardar y
  // quedarse" pueda pasar de POST a PATCH en clics subsiguientes sin navegar ni
  // cambiar el título del formulario a "Editar Producto".
  const [createdProductId, setCreatedProductId] = useState<string | undefined>(productId);
  const [featureInput, setFeatureInput] = useState('');
  const [careInput, setCareInput] = useState('');
  const [pickerTargetIndex, setPickerTargetIndex] = useState<number | 'append' | 'cover' | null>(null);
  const [pickerColorId, setPickerColorId] = useState<string | null>(null);
  // ─── Panel fijo de campos faltantes: se muestra tras un intento de guardado
  // inválido y se recalcula en cada render desde `errors` (RHF revalida en vivo los
  // campos que ya fallaron, así que la lista se va achicando sola a medida que el
  // usuario corrige, sin necesitar otro submit). ───
  const [showValidationBanner, setShowValidationBanner] = useState(false);
  // ─── Código de estilo: verificación de unicidad en vivo (Fase 3.4, ver brief C.1) ───
  const [codeStatus, setCodeStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  // Protección contra respuestas fuera de orden del debounce de check-code: cada
  // request lleva un id incremental y un AbortController; solo se aplica el
  // resultado si sigue siendo la request más reciente en vuelo.
  const codeCheckRequestIdRef = useRef(0);
  const codeCheckAbortRef = useRef<AbortController | null>(null);
  // Referencia al banner de validación — al fallar el guardado, lo llevamos a la
  // vista aunque el usuario esté scrolleado en la sección de variantes/medios.
  const validationBannerRef = useRef<HTMLDivElement | null>(null);


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
    getValues,
    trigger,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProductFormData>({
    resolver: zodResolver(ProductFormSchema) as any,
    defaultValues: initialData || {
      slug: '',
      name: '',
      description: '',
      sku: '',
      brandId: '',
      collectionId: '',
      code: '',
      productTypeId: '',
      styleAttributes: {},
      gender: 'UNISEX',
      priceNormal: '',
      visibility: initialVisibility ?? 'INDIVIDUAL',
      isNew: false,
      isBestSeller: false,
      isActive: true,
      features: [],
      careInstructions: [],
      variants: [],
      images: [],
      cover: {
        assetId: '',
        url: '',
        storageKey: '',
        mimeType: '',
        alt: '',
      },
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

  // Fetch product details if editing embedded
  useEffect(() => {
    if (productId && !initialData) {
      setLoadingProduct(true);
      fetch(`/api/admin/products/${productId}`)
        .then((res) => {
          if (!res.ok) throw new Error('Error al cargar detalles del producto');
          return res.json();
        })
        .then((product) => {
          reset({
            slug: product.slug,
            name: product.name,
            description: product.description || '',
            sku: product.sku || '',
            brandId: product.brandId,
            collectionId: product.collectionId || '',
            code: product.code || '',
            productTypeId: product.productTypeId || '',
            styleAttributes: {},
            gender: product.gender,
            priceNormal: product.priceNormal,
            priceSale: product.priceSale || '',
            discountPct: product.discountPct || undefined,
            discountEnd: product.discountEnd
              ? new Date(product.discountEnd).toISOString().slice(0, 16)
              : '',
            priceWholesale: product.priceWholesale || '',
            priceWholesaleSale: product.priceWholesaleSale || '',
            wholesaleDiscountEnd: product.wholesaleDiscountEnd
              ? new Date(product.wholesaleDiscountEnd).toISOString().slice(0, 16)
              : '',
            visibility: (product.visibility as 'INDIVIDUAL' | 'GROUPS' | 'BOTH') || 'INDIVIDUAL',
            isNew: product.isNew ?? false,
            isBestSeller: product.isBestSeller ?? false,
            isActive: product.isActive ?? true,
            features: (product.features as string[]) || [],
            careInstructions: (product.careInstructions as string[]) || [],
            crossSellId: product.crossSellId || '',
            variants: product.variants.map((v: any) => ({
              id: v.id,
              colorId: v.colorId,
              size: v.size,
              sku: v.sku || '',
              status: v.status,
              attributeValueIds: (v.attributeValueIds as string[]) || [],
            })),
            images: product.images.map((i: any) => ({
              id: i.id,
              assetId: i.assetId,
              colorId: i.colorId || '',
              url: i.url,
              storageKey: i.storageKey,
              mimeType: i.mimeType,
              alt: i.alt || '',
              sortOrder: i.sortOrder ?? 0,
            })),
            cover: product.cover
              ? {
                  id: product.cover.id,
                  assetId: product.cover.assetId,
                  url: product.cover.url,
                  storageKey: product.cover.storageKey,
                  mimeType: product.cover.mimeType,
                  alt: product.cover.alt || '',
                }
              : { assetId: '', url: '', storageKey: '', mimeType: '', alt: '' },
          });
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : 'Error al cargar detalles');
        })
        .finally(() => {
          setLoadingProduct(false);
        });
    }
  }, [productId, initialData, reset]);

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

  // ─── Selects dependientes Marca → Colección/Tipo de Producto (Fase 3.4, brief A) ───
  const brandIdValue = watch('brandId');
  useEffect(() => {
    if (!brandIdValue) {
      setCollections([]);
      setProductTypeOptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [colRes, ptRes] = await Promise.all([
          fetch(`/api/admin/collections?brandId=${brandIdValue}`),
          fetch(`/api/admin/product-types?brandId=${brandIdValue}`),
        ]);
        if (cancelled) return;
        if (colRes.ok) setCollections((await colRes.json()).collections || []);
        if (ptRes.ok) setProductTypeOptions((await ptRes.json()).productTypes || []);
      } catch {
        if (!cancelled) toast.error('Error al cargar colecciones/tipos de producto de la marca');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brandIdValue]);

  // Alta rápida de color desde el generador de matriz (sin salir del formulario,
  // ver `AttributeMatrixSection`/`AddColorDialog`) — se agrega a la lista de
  // colores disponibles en todo el formulario, no solo en ese componente.
  function handleColorCreated(color: Color) {
    setColors((prev) => [...prev, color].sort((a, b) => a.name.localeCompare(b.name)));
  }

  // `productTypeId` elegido — impulsa qué atributos EAV ofrece el generador de
  // matriz (`AttributeMatrixSection`/`VariantsMediaSection`). Los campos legacy
  // `category`/`productType`/`styles` fueron eliminados del esquema (Fase 5).
  const productTypeIdValue = watch('productTypeId');

  // Atributos "Estilo" (Atributos (Estilos), `/admin/atributos`) del Tipo de
  // Producto elegido — fuente única compartida entre la ficha General
  // (`AttributeStyleSection`) y el generador de matriz color×talla
  // (`VariantsMediaSection`/`AttributeMatrixSection`), para no duplicar el fetch.
  const { links: attributeLinks, valuesByAttribute, loading: loadingAttributes } =
    useProductTypeAttributes(productTypeIdValue);
  const styleAttributesValue = watch('styleAttributes');

  // Al cargar un producto existente, deriva `styleAttributes` (attributeId ->
  // valueId) a partir de los `attributeValueIds` ya guardados en sus variantes —
  // compatibilidad con productos guardados antes de este cambio, donde el valor
  // vivía por variante. Solo corre si `styleAttributes` sigue vacío (no pisa
  // ediciones del usuario en la misma sesión).
  useEffect(() => {
    if (attributeLinks.length === 0) return;
    if (Object.keys(getValues('styleAttributes') || {}).length > 0) return;
    const variants = getValues('variants');
    const sourceVariant = variants.find((v) => (v.attributeValueIds || []).length > 0);
    if (!sourceVariant) return;
    const derived: Record<string, string> = {};
    for (const link of attributeLinks) {
      const options = valuesByAttribute[link.attributeId] ?? [];
      const match = sourceVariant.attributeValueIds?.find((id) => options.some((o) => o.id === id));
      if (match) derived[link.attributeId] = match;
    }
    if (Object.keys(derived).length > 0) setValue('styleAttributes', derived);
  }, [attributeLinks, valuesByAttribute, getValues, setValue]);

  // ─── Código de Estilo: verificación de unicidad en vivo (Fase 3.4, brief C.1) ───
  const codeValue = watch('code');
  useEffect(() => {
    const trimmed = codeValue?.trim();
    if (!trimmed) {
      setCodeStatus('idle');
      return;
    }
    setCodeStatus('checking');
    const handle = setTimeout(async () => {
      // Cancela cualquier request anterior todavía en vuelo y reclama un nuevo id.
      codeCheckAbortRef.current?.abort();
      const controller = new AbortController();
      codeCheckAbortRef.current = controller;
      const requestId = ++codeCheckRequestIdRef.current;
      try {
        const params = new URLSearchParams({ code: trimmed });
        if (createdProductId) params.set('excludeProductId', createdProductId);
        const res = await fetch(`/api/admin/products/check-code?${params.toString()}`, {
          signal: controller.signal,
        });
        if (requestId !== codeCheckRequestIdRef.current) return; // respuesta obsoleta, ignorar
        if (!res.ok) {
          setCodeStatus('idle');
          return;
        }
        const json = await res.json();
        if (requestId !== codeCheckRequestIdRef.current) return;
        setCodeStatus(json.available ? 'available' : 'taken');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (requestId !== codeCheckRequestIdRef.current) return;
        setCodeStatus('idle');
      }
    }, 450);
    return () => clearTimeout(handle);
  }, [codeValue, createdProductId]);

  // Los "Atributos (Estilos)" se eligen una sola vez en General (`styleAttributes`)
  // pero el backend sigue esperando `attributeValueIds` por variante — se copia el
  // mismo conjunto de valores a todas las variantes justo antes de guardar, sin
  // tocar el modelo de datos existente (`variant_attribute_values`).
  function withSyncedStyleAttributes(data: ProductFormData): ProductFormData {
    const attributeValueIds = Object.values(data.styleAttributes ?? {}).filter(Boolean);
    return {
      ...data,
      variants: data.variants.map((v) => ({ ...v, attributeValueIds })),
    };
  }

  async function onSubmit(rawData: ProductFormData) {
    const data = withSyncedStyleAttributes(rawData);
    setSaving(true);
    setShowValidationBanner(false);
    try {
      const url = createdProductId ? `/api/admin/products/${createdProductId}` : '/api/admin/products';
      const method = createdProductId ? 'PATCH' : 'POST';
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
      if (!createdProductId) setCreatedProductId(saved.id);
      toast.success(createdProductId ? 'Producto actualizado' : 'Producto creado');
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

  // "Guardar y quedarse": misma lógica de guardado que `onSubmit`, pero sin
  // navegar — el admin sigue editando en la misma pantalla. Útil para ir
  // guardando avances en formularios largos (variantes, medios) sin el viaje de
  // ida y vuelta a la lista.
  async function onSaveAndStay(rawData: ProductFormData) {
    const data = withSyncedStyleAttributes(rawData);
    setSavingStay(true);
    setSaveStayStatus('saving');
    setShowValidationBanner(false);
    try {
      const url = createdProductId ? `/api/admin/products/${createdProductId}` : '/api/admin/products';
      const method = createdProductId ? 'PATCH' : 'POST';
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
      if (!createdProductId) setCreatedProductId(saved.id);
      toast.success('Cambios guardados');
      setSaveStayStatus('success');
      // Fija los valores recién guardados como nuevo "punto limpio" del form —
      // sin esto, `formState.isDirty` seguiría en `true` (compara contra los
      // valores originales de carga) y el botón flotante quedaría ámbar aunque
      // ya no haya cambios sin guardar.
      reset(data, { keepDirty: false });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
      setSaveStayStatus('error');
    } finally {
      setSavingStay(false);
    }
  }

  const onInvalid = (errors: any) => {
    console.error('Errores de validación en ProductForm:', errors);
    setShowValidationBanner(true);
    const summary = buildValidationSummary(errors);
    toast.error(
      summary.length > 0
        ? `Faltan ${summary.length} campo${summary.length === 1 ? '' : 's'} obligatorio${summary.length === 1 ? '' : 's'} — revisa el panel de arriba`
        : 'Complete todos los campos requeridos'
    );
    // El banner puede quedar fuera de la vista si el usuario está scrolleado en
    // secciones más abajo (ej. variantes/medios) — lo traemos a la vista.
    requestAnimationFrame(() => {
      validationBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  // Recalculado en cada render desde `errors` (no un snapshot en estado): a medida
  // que el usuario corrige un campo, RHF revalida ese campo en vivo (reValidateMode
  // por defecto 'onChange' tras el primer intento fallido) y esta lista se achica
  // sola, sin necesitar otro submit.
  const validationSummary = buildValidationSummary(errors);


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

  if (loading || loadingProduct) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  // ─── Feedback visual del check de unicidad del código de estilo (brief C.1) ───
  const codeStatusIndicator = (() => {
    if (codeStatus === 'checking') {
      return (
        <p className="text-xs text-gray-500 flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verificando disponibilidad...
        </p>
      );
    }
    if (codeStatus === 'available') {
      return (
        <p className="text-xs text-emerald-600 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> Código disponible
        </p>
      );
    }
    if (codeStatus === 'taken') {
      return (
        <p className="text-xs text-red-500 flex items-center gap-1.5">
          <XCircle className="w-3.5 h-3.5" /> Este código ya está en uso por otro producto
        </p>
      );
    }
    return null;
  })();

  const mediaPickerDialog = (
    <MediaPicker
      open={pickerTargetIndex !== null}
      onClose={() => {
        setPickerTargetIndex(null);
        setPickerColorId(null);
      }}
      folder="PRODUCTS"
      segments={slugValue ? [slugValue] : []}
      multiple={pickerTargetIndex === 'append'}
      onConfirm={(assets) => {
        if (pickerTargetIndex === 'append') {
          assets.forEach((asset, i) => {
            appendImage({
              assetId: asset.id,
              colorId: pickerColorId || '',
              url: resolveMediaUrl(asset.storageKey),
              storageKey: asset.storageKey,
              mimeType: asset.mimeType,
              alt: asset.altText ?? '',
              sortOrder: imageFields.length + i,
            });
          });
        } else if (pickerTargetIndex === 'cover' && assets[0]) {
          setValue('cover.assetId', assets[0].id);
          setValue('cover.url', resolveMediaUrl(assets[0].storageKey));
          setValue('cover.storageKey', assets[0].storageKey);
          setValue('cover.mimeType', assets[0].mimeType);
          if (!watch('cover.alt')) {
            setValue('cover.alt', assets[0].altText ?? '');
          }
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
        setPickerColorId(null);
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
            onClick={() => handleSubmit(onSubmit, onInvalid)()}
            disabled={saving}
            className="bg-[#111111]"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(onSubmit, onInvalid)(); }}>
        {showValidationBanner && validationSummary.length > 0 && (
          <Alert ref={validationBannerRef} variant="destructive" className="mb-4">
            <AlertCircle className="w-4 h-4" />
            <AlertTitle>
              Faltan {validationSummary.length} campo{validationSummary.length === 1 ? '' : 's'} obligatorio{validationSummary.length === 1 ? '' : 's'} para poder guardar
            </AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4 space-y-0.5">
                {validationSummary.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
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
                          <Select
                            value={field.value}
                            onValueChange={(val) => {
                              field.onChange(val);
                              setValue('collectionId', '');
                              setValue('productTypeId', '');
                            }}
                          >
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
                      <Label htmlFor="m-collectionId">Colección</Label>
                      <Controller
                        name="collectionId"
                        control={control}
                        render={({ field }) => (
                          <Select
                            value={field.value || '__empty__'}
                            onValueChange={(val) => field.onChange(val === '__empty__' ? '' : val)}
                            disabled={!brandIdValue}
                          >
                            <SelectTrigger id="m-collectionId">
                              <SelectValue placeholder="Sin colección" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__empty__">— Sin colección —</SelectItem>
                              {collections.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="m-productTypeId">Tipo de Producto *</Label>
                      <Controller
                        name="productTypeId"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange} disabled={!brandIdValue}>
                            <SelectTrigger id="m-productTypeId">
                              <SelectValue placeholder={brandIdValue ? 'Seleccionar tipo de producto' : 'Elige una marca primero'} />
                            </SelectTrigger>
                            <SelectContent>
                              {productTypeOptions.map(pt => (
                                <SelectItem key={pt.id} value={pt.id} disabled={!pt.isActive}>
                                  {pt.name}{!pt.isActive ? ' (Inactivo)' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.productTypeId && <p className="text-sm text-red-500">{errors.productTypeId.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="m-code">Código de Estilo *</Label>
                      <Input id="m-code" {...register('code')} placeholder="Ej: 2624A" />
                      {errors.code && <p className="text-sm text-red-500">{errors.code.message}</p>}
                      {codeStatusIndicator}
                    </div>
                    <AttributeStyleSection
                      control={control}
                      productTypeId={productTypeIdValue}
                      links={attributeLinks}
                      valuesByAttribute={valuesByAttribute}
                      loading={loadingAttributes}
                    />
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
                    </Accordion>
                    <p className="px-4 pb-2 pt-3 text-xs text-gray-500">
                      Los estilos del producto ahora se gestionan como atributos por
                      variante en el paso &quot;Variantes y Medios&quot; (Colores/Tallas y los
                      atributos del Tipo de Producto elegido).
                    </p>
                  </CardContent>
                </Card>
              )}

              {currentStep.id === 'variants_and_media' && (
                <VariantsMediaSection
                  control={control}
                  register={register}
                  watch={watch}
                  setValue={setValue}
                  colors={colors}
                  productTypeId={productTypeIdValue}
                  styleAttributes={styleAttributesValue}
                  variantFields={variantFields}
                  appendVariant={appendVariant}
                  removeVariant={removeVariant}
                  imageFields={imageFields}
                  removeImage={removeImage}
                  variantsErrors={errors.variants}
                  formErrors={errors}
                  onColorCreated={handleColorCreated}
                  onPickTarget={(target, colorId) => {
                    setPickerTargetIndex(target);
                    if (colorId) setPickerColorId(colorId);
                  }}
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
                  onClick={() => handleSubmit(onSubmit, onInvalid)()}
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
              <TabsTrigger value="variants_media">
                Variantes y Medios
                {variantFields.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {variantFields.length} var · {imageFields.length} med
                  </Badge>
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
                          <Select
                            value={field.value}
                            onValueChange={(val) => {
                              field.onChange(val);
                              setValue('collectionId', '');
                              setValue('productTypeId', '');
                            }}
                          >
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
                      <Label htmlFor="collectionId">Colección</Label>
                      <Controller
                        name="collectionId"
                        control={control}
                        render={({ field }) => (
                          <Select
                            value={field.value || '__empty__'}
                            onValueChange={(val) => field.onChange(val === '__empty__' ? '' : val)}
                            disabled={!brandIdValue}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sin colección" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__empty__">— Sin colección —</SelectItem>
                              {collections.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="productTypeId">Tipo de Producto *</Label>
                      <Controller
                        name="productTypeId"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange} disabled={!brandIdValue}>
                            <SelectTrigger>
                              <SelectValue placeholder={brandIdValue ? 'Seleccionar tipo de producto' : 'Elige una marca primero'} />
                            </SelectTrigger>
                            <SelectContent>
                              {productTypeOptions.map(pt => (
                                <SelectItem key={pt.id} value={pt.id} disabled={!pt.isActive}>
                                  {pt.name}{!pt.isActive ? ' (Inactivo)' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.productTypeId && <p className="text-sm text-red-500">{errors.productTypeId.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="code">Código de Estilo *</Label>
                      <Input id="code" {...register('code')} placeholder="Ej: 2624A" />
                      {errors.code && <p className="text-sm text-red-500">{errors.code.message}</p>}
                      {codeStatusIndicator}
                    </div>
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
                  </div>

                  <AttributeStyleSection
                    control={control}
                    productTypeId={productTypeIdValue}
                    links={attributeLinks}
                    valuesByAttribute={valuesByAttribute}
                    loading={loadingAttributes}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

              {/* Estilos: gestionados ahora como atributos EAV por variante (Fase 3.4) */}
              <Card>
                <CardContent className="p-6">
                  <p className="text-xs text-gray-500">
                    Los estilos del producto ahora se gestionan como atributos por
                    variante en la pestaña &quot;Variantes y Medios&quot; (Colores/Tallas y los
                    atributos del Tipo de Producto elegido).
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ─── TAB VARIANTES Y MEDIOS ─── */}
            <TabsContent value="variants_media" className="space-y-4">
              <VariantsMediaSection
                control={control}
                register={register}
                watch={watch}
                setValue={setValue}
                colors={colors}
                productTypeId={productTypeIdValue}
                styleAttributes={styleAttributesValue}
                variantFields={variantFields}
                appendVariant={appendVariant}
                removeVariant={removeVariant}
                imageFields={imageFields}
                removeImage={removeImage}
                variantsErrors={errors.variants}
                formErrors={errors}
                onColorCreated={handleColorCreated}
                onPickTarget={(target, colorId) => {
                  setPickerTargetIndex(target);
                  if (colorId) setPickerColorId(colorId);
                }}
              />
            </TabsContent>


          </Tabs>
        )}
      </form>

      {mediaPickerDialog}

      {/* ─── Botón flotante "Guardar y quedarse" ─── */}
      <FloatingSaveButton
        status={saveStayStatus}
        onClick={() => handleSubmit(onSaveAndStay, onInvalid)()}
        disabled={saving || savingStay}
        isDirty={isDirty}
      />
    </div>
  );
}
