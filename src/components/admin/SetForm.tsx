'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, useFieldArray, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { ArrowLeft, Save, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { MediaPicker } from '@/components/admin/media/MediaPicker';
import { resolveMediaUrl, sanitizeCodeSegment, COVER_SEGMENT } from '@/lib/media';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import ProductForm from '@/components/admin/ProductForm';
import { RuleForm } from '@/components/admin/RuleForm';
import { FloatingSaveButton, type FloatingSaveStatus } from '@/components/admin/FloatingSaveButton';
import {
  SetFormSchema,
  type SetFormData,
  type EligibleProduct,
  type SetRuleRow,
  productPrice,
} from '@/components/admin/set-form/schema';
import {
  SET_FORM_WIZARD_STEPS,
  getStepProgressLabel,
  canNavigateToStep,
  nextMaxVisitedIndex,
} from '@/components/admin/set-form/wizard-steps';
import { GeneralSection } from '@/components/admin/set-form/GeneralSection';
import { SetColorsSection } from '@/components/admin/set-form/SetColorsSection';
import { ColorModeGate } from '@/components/admin/set-form/ColorModeGate';
import { PairedColorAccordion } from '@/components/admin/set-form/PairedColorAccordion';
import { MixedColorAccordion } from '@/components/admin/set-form/MixedColorAccordion';
import { BlockSection } from '@/components/admin/set-form/BlockSection';
import { RecommendedItemsSection } from '@/components/admin/set-form/RecommendedItemsSection';
import { PriceSection } from '@/components/admin/set-form/PriceSection';
import { RulesSection } from '@/components/admin/set-form/RulesSection';
import { buildSetValidationSummary } from '@/components/admin/set-form/validation-summary';
import { useActivityTracking } from '@/hooks/useActivityTracking';
import { useAnchoredTask } from '@/contexts/AnchoredTaskContext';
import { TaskAnchorControl } from '@/components/admin/TaskAnchorControl';
import { slugify } from '@/lib/slugify';

const SET_ANCHOR_TYPES = ['CREATE_SET', 'EDIT_SET'];

interface SetFormProps {
  setId?: string;
  initialData?: SetFormData;
}

export default function SetForm({ setId, initialData }: SetFormProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [products, setProducts] = useState<EligibleProduct[]>([]);
  const [loading, setLoading] = useState(true);
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
  // Id real del set en el servidor una vez creado — separado de la prop `setId`
  // (que sigue reflejando la URL/modo original) para que "Guardar y quedarse"
  // pueda pasar de POST a PATCH en clics subsiguientes sin navegar.
  const [createdSetId, setCreatedSetId] = useState<string | undefined>(setId);
  // Fase 7 del plan RBAC: registro de productividad del Gestor del Catálogo.
  const { finish: finishActivity } = useActivityTracking('SET', setId, initialData as Record<string, unknown> | undefined);
  // Anclaje de tareas (2026-07-26): ver equivalente en ProductForm.tsx.
  const { anchoredTask, updateAnchoredStatus } = useAnchoredTask();
  const [savingAnchored, setSavingAnchored] = useState<'progress' | 'complete' | null>(null);
  const [showValidationBanner, setShowValidationBanner] = useState(false);
  // `colorIndex` identifica la fila de `setColors` a la que aplica esta selección de portada
  // (Set × Color desacoplado de "Datos generales" — ver SetColorsSection.tsx).
  const [pickerRequest, setPickerRequest] = useState<{ colorIndex: number; target: 'cover' | 'secondaryCover'; mode: 'special' | 'content' } | null>(null);
  // Snapshot de productIds vigentes al momento de elegir una portada en modo
  // "Portadas del contenido" — si luego se quita del set alguno de esos
  // productos, avisamos que la portada podría ya no ser válida (Fase 2.4,
  // PLAN-ajustes-admin-sets.md). No identifica el producto exacto del asset
  // elegido (eso requeriría una consulta extra a media_links por selección),
  // así que el aviso es conservador: se dispara si el producto quitado
  // formaba parte del alcance de la galería consultada, no solo si es
  // certeramente el dueño de la imagen. Clave: `${colorIndex}:${target}`.
  const [coverContentScope, setCoverContentScope] = useState<Record<string, string[]>>({});
  const [optionComboOpen, setOptionComboOpen] = useState<string | null>(null);
  const [recommendedComboOpen, setRecommendedComboOpen] = useState<number | null>(null);

  // Drawer de producto (crear pieza nueva / editar pieza existente sin salir del set) — el
  // target identifica si la pieza vive en un bloque (blockIndex/optionIndex) o en la lista de
  // recomendadas (recommendedIndex), nunca ambos.
  type ProductDrawerTarget =
    | { productId?: string; blockIndex: 0 | 1; optionIndex: 0 | 1 }
    | { productId?: string; recommendedIndex: number };
  const [productDrawer, setProductDrawer] = useState<ProductDrawerTarget | null>(null);

  // Sección "Reglas de este set" (solo edición)
  const [setRules, setSetRules] = useState<SetRuleRow[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [ruleDrawer, setRuleDrawer] = useState<{ ruleId?: string } | null>(null);

  // ─── Wizard mobile: paso actual y pasos ya visitados ───
  // Solo tiene efecto cuando `isMobile` es true; en desktop se ignora por
  // completo (se renderizan siempre los mismos 4 Cards en secuencia).
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
    formState: { errors },
  } = useForm<SetFormData>({
    resolver: zodResolver(SetFormSchema) as never,
    defaultValues: initialData || {
      name: '',
      slug: '',
      description: '',
      isActive: true,
      isFeatured: false,
      blocks: [
        { blockCode: 'A', quantityPerSet: 1, options: [{ productId: '' }] },
        { blockCode: 'B', quantityPerSet: 1, options: [{ productId: '' }] },
      ],
      recommendedItems: [],
      setColors: [],
    },
  });

  const {
    fields: recommendedFields,
    append: appendRecommended,
    remove: removeRecommended,
  } = useFieldArray({ control, name: 'recommendedItems' });
  const blocks = watch('blocks');
  const recommendedItems = watch('recommendedItems');
  const colorMode = watch('colorMode');

  // Todas las piezas del set (4 opciones de bloque + recomendadas) — usado por los acordeones de
  // color (paridad/combos), por el chequeo de duplicados entre bloques y por `hasPieces` en
  // "Portadas por color". Sin `useMemo`: memoizar sobre `[blocks, recommendedItems]` (ambos
  // provenientes de `watch()`) quedaba con una referencia stale un ciclo de render después de
  // elegir producto en un bloque, dejando `hasPieces` en `false` aunque los bloques ya tuvieran
  // piezas — el recálculo es barato (aplanar 2-4 items), no vale la pena el riesgo.
  const allPieceItems = [
    ...blocks.flatMap((b) => b.options.map((o) => ({ productId: o.productId, quantityPerSet: b.quantityPerSet }))),
    ...recommendedItems.map((r) => ({ productId: r.productId, quantityPerSet: 1 })),
  ];
  const blockOnlyItems = blocks.flatMap((b) => b.options.map((o) => ({ productId: o.productId, quantityPerSet: b.quantityPerSet })));

  // Piezas del set para el selector "ver por pieza" del picker de portadas en modo "Portadas del
  // contenido" — reutiliza `products` (ya en memoria) en vez de pedirle a MediaPicker que traiga
  // el catálogo completo + colores por producto (mecanismo genérico de "otra ubicación").
  const allPieceProductIds = allPieceItems.map((i) => i.productId).filter(Boolean).join(',');
  const scopedCoverProducts = useMemo(() => {
    const ids = Array.from(new Set(allPieceProductIds.split(',').filter(Boolean)));
    return ids
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is EligibleProduct => Boolean(p))
      .map((p) => ({ id: p.id, name: p.name, code: p.code, brandName: p.brandName, colors: p.colors }));
  }, [allPieceProductIds, products]);

  // `colorCode` de la fila de `setColors` objetivo del picker abierto — determina la subcarpeta
  // de storage (`sets/{slug}/portada/{colorCode}/`, ver `SetColorsSection`/`buildSetMediaKey`).
  const setColorsValue = watch('setColors');
  const pickerColorCode = useMemo(() => {
    if (!pickerRequest) return undefined;
    const colorId = setColorsValue?.[pickerRequest.colorIndex]?.colorId;
    if (!colorId) return undefined;
    for (const p of products) {
      const color = p.colors.find((c) => c.id === colorId);
      if (color) return color.code;
    }
    return undefined;
  }, [pickerRequest, setColorsValue, products]);

  /** Quita una pieza recomendada y avisa si podría haber sido la fuente de alguna portada
   * elegida en modo "Portadas del contenido" (Fase 2.4). */
  function handleRemoveRecommended(index: number) {
    const removedProductId = recommendedItems[index]?.productId;
    removeRecommended(index);
    if (!removedProductId) return;
    const affected = Object.values(coverContentScope).some((productIds) => productIds.includes(removedProductId));
    if (affected) {
      toast.warning(
        'Quitaste una pieza cuya galería pudo haber aportado alguna portada por color — revisa que sigan siendo válidas antes de guardar.'
      );
    }
  }

  // Cambiar de modalidad ya elegida cambia cómo el comprador elige color en el catálogo público
  // (duplas vs. combos curados) — se confirma con el usuario antes de aplicar el cambio. Las
  // piezas de los bloques son compartidas por ambos modos y nunca se limpian; las combinaciones
  // curadas de "mezcladas" simplemente dejan de usarse mientras el set no esté en ese modo.
  function handleColorModeChange(next: 'PAIRED' | 'MIXED') {
    if (colorMode && colorMode !== next) {
      if (!confirm('Cambiar el modo de color afecta cómo el comprador elige color en este set. ¿Continuar?')) return;
    }
    setValue('colorMode', next, { shouldValidate: true });
  }

  const [manualPriceEnabled, setManualPriceEnabled] = useState(Boolean(initialData?.priceManual));

  const fetchProducts = useCallback(async () => {
    const res = await fetch('/api/admin/products/eligible-for-sets');
    if (res.ok) setProducts((await res.json()).products || []);
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
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

  // Los sets no tienen `code` (a diferencia de productos, plan 2026-07-27 decisión 11) — el
  // slug sigue derivándose de `name`, solo migrado a la función `slugify()` compartida
  // (antes regex inline duplicada, no normalizaba tildes/ñ igual que la de `src/lib/slugify.ts`).
  const nameValue = watch('name');
  const slugValue = watch('slug');
  useEffect(() => {
    if (!setId && nameValue && !slugValue) {
      setValue('slug', slugify(nameValue));
    }
  }, [nameValue, slugValue, setId, setValue]);

  // ── Vista previa de precio referencial: "Desde $X" — mínimo de cada bloque × su cantidad,
  // sumado entre bloques (Decisión 3 del plan). Las piezas recomendadas nunca participan. ──
  const pricePreview = blocks.reduce(
    (acc, block) => {
      const prices = block.options
        .map((o) => productPrice(products.find((p) => p.id === o.productId)))
        .filter((p): p is number => p !== null);
      if (prices.length === 0) {
        acc.hasMissing = true;
        return acc;
      }
      acc.total += Math.min(...prices) * (block.quantityPerSet || 1);
      return acc;
    },
    { total: 0, hasMissing: false }
  );

  const priceManualValue = watch('priceManual');
  const priceManualNumber = priceManualValue ? Number(priceManualValue) : null;
  const deltaPct = priceManualNumber && pricePreview.total > 0
    ? Math.round(((priceManualNumber - pricePreview.total) / pricePreview.total) * 100)
    : null;

  function buildSetPayload(data: SetFormData) {
    return {
      ...data,
      priceManual: manualPriceEnabled ? (data.priceManual || null) : null,
      priceManualSale: manualPriceEnabled ? (data.priceManualSale || null) : null,
      manualDiscountEnd: manualPriceEnabled ? (data.manualDiscountEnd || null) : null,
      recommendedItems: data.recommendedItems.map((item, idx) => ({ ...item, sortOrder: idx })),
      setColors: data.setColors.map((c, idx) => ({ ...c, sortOrder: idx })),
    };
  }

  async function onSubmit(data: SetFormData) {
    setSaving(true);
    setShowValidationBanner(false);
    try {
      const payload = buildSetPayload(data);
      const url = createdSetId ? `/api/admin/sets/${createdSetId}` : '/api/admin/sets';
      const method = createdSetId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al guardar');
      }
      const saved = await res.json();
      if (!createdSetId) setCreatedSetId(saved.id);
      finishActivity(saved.id, payload as unknown as Record<string, unknown>, anchoredTask?.id);
      toast.success(createdSetId ? 'Set actualizado' : 'Set creado');
      router.push('/admin/sets');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  /** Guarda con la tarea/subtarea anclada como destino — ver equivalente en ProductForm.tsx. */
  async function saveWithAnchoredTask(mode: 'progress' | 'complete') {
    if (!anchoredTask) return;
    const rawData = getValues();
    const valid = await trigger();
    if (!valid) {
      setShowValidationBanner(true);
      toast.error('Revisa los campos obligatorios antes de guardar');
      return;
    }
    const payload = buildSetPayload(rawData);
    if (mode === 'progress') payload.isActive = false;

    setSavingAnchored(mode);
    setShowValidationBanner(false);
    try {
      const url = createdSetId ? `/api/admin/sets/${createdSetId}` : '/api/admin/sets';
      const method = createdSetId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al guardar');
      }
      const saved = await res.json();
      if (!createdSetId) setCreatedSetId(saved.id);
      finishActivity(saved.id, payload as unknown as Record<string, unknown>, anchoredTask.id);

      const advanceRes = await fetch(`/api/admin/tasks/${anchoredTask.id}/advance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'progress'
            ? { toStatus: 'IN_PROGRESS' }
            : { toStatus: 'COMPLETED', targetEntityId: saved.id }
        ),
      }).catch(() => null);

      if (!advanceRes?.ok) {
        const errData = await advanceRes?.json().catch(() => ({}));
        toast.error(
          `El set se guardó, pero la tarea anclada NO se actualizó${errData?.error ? `: ${errData.error}` : ''}. Reintenta desde el panel de tareas.`,
          { duration: 8000 }
        );
      } else if (mode === 'complete') {
        updateAnchoredStatus('COMPLETED');
        toast.success('Set guardado — tarea por revisar');
      } else {
        updateAnchoredStatus('IN_PROGRESS');
        toast.success('Set guardado — tarea en progreso');
      }
      reset(payload as unknown as SetFormData, { keepDirty: false });
      await refreshSetRules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSavingAnchored(null);
    }
  }

  // "Guardar y quedarse": misma lógica que `onSubmit` pero sin navegar, para ir
  // guardando avances del set sin salir del formulario.
  async function onSaveAndStay(data: SetFormData) {
    setSavingStay(true);
    setSaveStayStatus('saving');
    setShowValidationBanner(false);
    try {
      const payload = buildSetPayload(data);
      const url = createdSetId ? `/api/admin/sets/${createdSetId}` : '/api/admin/sets';
      const method = createdSetId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al guardar');
      }
      const saved = await res.json();
      if (!createdSetId) setCreatedSetId(saved.id);
      finishActivity(saved.id, payload as unknown as Record<string, unknown>, anchoredTask?.id);
      toast.success('Cambios guardados');
      setSaveStayStatus('success');
      await refreshSetRules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
      setSaveStayStatus('error');
    } finally {
      setSavingStay(false);
    }
  }

  const onInvalid = (errors: FieldErrors<SetFormData>) => {
    setShowValidationBanner(true);
    const summary = buildSetValidationSummary(errors);
    toast.error(
      summary.length > 0
        ? `Faltan ${summary.length} campo${summary.length === 1 ? '' : 's'} obligatorio${summary.length === 1 ? '' : 's'} — revisa el panel de arriba`
        : 'Complete todos los campos requeridos'
    );
  };

  const validationSummary = buildSetValidationSummary(errors);

  const rulesByType = useMemo(() => {
    const map = new Map<SetRuleRow['ruleType'], SetRuleRow[]>();
    for (const r of setRules) {
      const list = map.get(r.ruleType) ?? [];
      list.push(r);
      map.set(r.ruleType, list);
    }
    return map;
  }, [setRules]);

  /** Contenido del paso "Bloques del set": los 2 bloques fijos (A/B), el acordeón de color
   * correspondiente al modo elegido, y la sección de piezas recomendadas — idéntico en desktop
   * (Card secuencial) y en el paso 3 del wizard mobile. */
  function renderBlocksAndRecommended() {
    const usedProductIds = allPieceItems.map((i) => i.productId).filter(Boolean);
    /** Activa/desactiva la 2da opción de un bloque — agrega un slot vacío o lo quita
     * (junto con su productId), sin tocar la 1ra opción ni la cantidad del bloque. */
    function toggleSecondOption(blockIndex: 0 | 1, enabled: boolean) {
      const current = blocks[blockIndex]?.options ?? [{ productId: '' }];
      const next = enabled
        ? [current[0] ?? { productId: '' }, current[1] ?? { productId: '' }]
        : [current[0] ?? { productId: '' }];
      setValue(`blocks.${blockIndex}.options`, next, { shouldValidate: true });
    }
    return (
      <div className="space-y-4">
        <BlockSection
          blockIndex={0}
          blockCode="A"
          control={control}
          errors={errors}
          products={products}
          optionComboOpen={optionComboOpen}
          setOptionComboOpen={setOptionComboOpen}
          onOpenProductDrawer={setProductDrawer}
          selectedProductIds={usedProductIds}
          optionProductIds={(blocks[0]?.options ?? []).map((o) => o.productId ?? '')}
          hasSecondOption={(blocks[0]?.options?.length ?? 0) >= 2}
          onToggleSecondOption={(enabled) => toggleSecondOption(0, enabled)}
        />
        <BlockSection
          blockIndex={1}
          blockCode="B"
          control={control}
          errors={errors}
          products={products}
          optionComboOpen={optionComboOpen}
          setOptionComboOpen={setOptionComboOpen}
          onOpenProductDrawer={setProductDrawer}
          selectedProductIds={usedProductIds}
          optionProductIds={(blocks[1]?.options ?? []).map((o) => o.productId ?? '')}
          hasSecondOption={(blocks[1]?.options?.length ?? 0) >= 2}
          onToggleSecondOption={(enabled) => toggleSecondOption(1, enabled)}
        />
        {colorMode === 'PAIRED' && <PairedColorAccordion items={blockOnlyItems} products={products} />}
        {colorMode === 'MIXED' && <MixedColorAccordion setId={createdSetId} items={blockOnlyItems} products={products} />}
        <RecommendedItemsSection
          control={control}
          fields={recommendedFields}
          items={recommendedItems}
          products={products}
          append={appendRecommended}
          remove={handleRemoveRecommended}
          comboOpenIndex={recommendedComboOpen}
          setComboOpenIndex={setRecommendedComboOpen}
          onOpenProductDrawer={setProductDrawer}
        />
      </div>
    );
  }

  // ─── Navegación del wizard mobile ───

  const totalSteps = SET_FORM_WIZARD_STEPS.length;
  const currentStep = SET_FORM_WIZARD_STEPS[currentStepIndex];
  const isLastWizardStep = currentStepIndex === totalSteps - 1;

  /**
   * Navegación libre entre pasos: un paso ya visitado se puede reabrir sin
   * revalidar (permite volver atrás a corregir). Para saltar hacia adelante a
   * un paso no visitado, se validan en cascada todos los pasos intermedios
   * (desde el actual hasta el destino) — si alguno falla, la navegación se
   * detiene ahí y `trigger()` deja los errores visibles en pantalla.
   */
  async function goToStep(index: number) {
    if (index === currentStepIndex) return;
    if (canNavigateToStep(index, maxVisitedStepIndex)) {
      setCurrentStepIndex(index);
      return;
    }
    if (index < currentStepIndex) {
      setCurrentStepIndex(index);
      return;
    }

    for (let i = currentStepIndex; i < index; i++) {
      const stepFields = SET_FORM_WIZARD_STEPS[i].fields;
      const valid = stepFields.length === 0 ? true : await trigger(stepFields as (keyof SetFormData)[]);
      if (!valid) {
        setCurrentStepIndex(i);
        setMaxVisitedStepIndex((m) => nextMaxVisitedIndex(m, i));
        return;
      }
    }

    setCurrentStepIndex(index);
    setMaxVisitedStepIndex((m) => nextMaxVisitedIndex(m, index));
  }

  async function goToNextStep() {
    await goToStep(currentStepIndex + 1);
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

  return (
    <div className="p-4 md:p-8 max-w-5xl">
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
        <Button onClick={() => handleSubmit(onSubmit, onInvalid)()} disabled={saving} className="bg-[#111111]">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>

      <TaskAnchorControl panelTypes={SET_ANCHOR_TYPES}>
        {anchoredTask && (
          <Alert className="border-emerald-200 bg-emerald-50">
            <AlertTitle className="text-emerald-800">Tarea anclada: {anchoredTask.title}</AlertTitle>
            <AlertDescription>
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={savingAnchored !== null}
                  onClick={() => saveWithAnchoredTask('progress')}
                >
                  {savingAnchored === 'progress' ? 'Guardando...' : 'Guardar y continuar después'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={savingAnchored !== null}
                  onClick={() => saveWithAnchoredTask('complete')}
                >
                  {savingAnchored === 'complete' ? 'Guardando...' : 'Guardar y completar tarea'}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </TaskAnchorControl>

      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(onSubmit, onInvalid)(); }}>
        {showValidationBanner && validationSummary.length > 0 && (
          <Alert variant="destructive" className="mb-4">
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
                {SET_FORM_WIZARD_STEPS.map((step, index) => {
                  const isVisited = canNavigateToStep(index, maxVisitedStepIndex);
                  const isCurrent = index === currentStepIndex;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      role="tab"
                      aria-selected={isCurrent}
                      aria-label={`Paso ${index + 1}: ${step.label}`}
                      onClick={() => goToStep(index)}
                      className={cn(
                        'min-h-11 flex-1 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]',
                        isCurrent ? 'bg-[#111111]' : isVisited ? 'bg-gray-400' : 'bg-gray-200'
                      )}
                    />
                  );
                })}
              </div>
            </div>

            {/* ─── Contenido del paso actual ─── */}
            <div className="motion-reduce:transition-none transition-opacity">
              {currentStep.id === 'general' && (
                <GeneralSection
                  register={register}
                  control={control}
                  errors={errors}
                />
              )}

              {currentStep.id === 'color-mode' && (
                <ColorModeGate value={colorMode} onChange={handleColorModeChange} nameFilled={Boolean(nameValue?.trim())} />
              )}

              {currentStep.id === 'pieces' && renderBlocksAndRecommended()}

              {currentStep.id === 'set-colors' && (
                <SetColorsSection
                  register={register}
                  control={control}
                  errors={errors}
                  watch={watch}
                  setValue={setValue}
                  setId={createdSetId}
                  colorMode={colorMode}
                  blockItems={blockOnlyItems}
                  products={products}
                  hasPieces={allPieceItems.some((i) => i.productId)}
                  onOpenPicker={(colorIndex, target, mode) => setPickerRequest({ colorIndex, target, mode })}
                />
              )}

              {currentStep.id === 'price' && (
                <PriceSection
                  register={register}
                  manualPriceEnabled={manualPriceEnabled}
                  setManualPriceEnabled={setManualPriceEnabled}
                  pricePreview={pricePreview}
                  deltaPct={deltaPct}
                />
              )}

              {currentStep.id === 'rules' && (
                <RulesSection
                  setId={setId}
                  rulesLoading={rulesLoading}
                  rulesByType={rulesByType}
                  onNewRule={() => setRuleDrawer({})}
                  onEditRule={(ruleId) => setRuleDrawer({ ruleId })}
                />
              )}
            </div>

            {/* ─── Barra sticky inferior: Atrás / Guardar y quedarse / Siguiente ───
                Fija justo arriba del menú de navegación inferior de la app — el
                botón "Guardar y quedarse" vive aquí (`inline`), centrado, en vez
                de flotar suelto sobre el contenido. */}
            <div
              className={cn(
                'sticky z-10 grid grid-cols-[auto_1fr_auto] items-center gap-2 border-t bg-white/95 backdrop-blur px-4 py-3 -mx-4',
                'bottom-[calc(5rem_+_env(safe-area-inset-bottom))]'
              )}
            >
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

              <div className="justify-self-center">
                <FloatingSaveButton
                  inline
                  status={saveStayStatus}
                  onClick={() => handleSubmit(onSaveAndStay, onInvalid)()}
                  disabled={saving || savingStay}
                />
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
          <div className="space-y-6">
            <GeneralSection
              register={register}
              control={control}
              errors={errors}
            />

            <ColorModeGate value={colorMode} onChange={handleColorModeChange} nameFilled={Boolean(nameValue?.trim())} />

            {colorMode && renderBlocksAndRecommended()}

            {colorMode && (
              <SetColorsSection
                register={register}
                control={control}
                errors={errors}
                watch={watch}
                setValue={setValue}
                setId={createdSetId}
                colorMode={colorMode}
                blockItems={blockOnlyItems}
                products={products}
                hasPieces={allPieceItems.some((i) => i.productId)}
                onOpenPicker={(colorIndex, target, mode) => setPickerRequest({ colorIndex, target, mode })}
              />
            )}

            <PriceSection
              register={register}
              manualPriceEnabled={manualPriceEnabled}
              setManualPriceEnabled={setManualPriceEnabled}
              pricePreview={pricePreview}
              deltaPct={deltaPct}
            />

            <RulesSection
              setId={setId}
              rulesLoading={rulesLoading}
              rulesByType={rulesByType}
              onNewRule={() => setRuleDrawer({})}
              onEditRule={(ruleId) => setRuleDrawer({ ruleId })}
            />
          </div>
        )}
      </form>

      {/* ─── Botón flotante "Guardar y quedarse" (solo desktop) ───
          En mobile vive dentro de la barra sticky inferior (Atrás/Siguiente),
          no flota suelto — ver el `FloatingSaveButton inline` más arriba. */}
      {!isMobile && (
        <FloatingSaveButton
          status={saveStayStatus}
          onClick={() => handleSubmit(onSaveAndStay, onInvalid)()}
          disabled={saving || savingStay}
        />
      )}

      <MediaPicker
        open={pickerRequest !== null}
        onClose={() => setPickerRequest(null)}
        folder="SETS"
        segments={
          slugValue?.trim() && pickerRequest
            ? [sanitizeCodeSegment(slugValue.trim()), COVER_SEGMENT, ...(pickerColorCode ? [sanitizeCodeSegment(pickerColorCode)] : [])]
            : []
        }
        keyPrefix={
          pickerRequest?.mode === 'special' && slugValue?.trim()
            ? `sets/${sanitizeCodeSegment(slugValue.trim())}/${COVER_SEGMENT}/${pickerColorCode ? `${sanitizeCodeSegment(pickerColorCode)}/` : ''}`
            : undefined
        }
        linkedEntityType={pickerRequest?.mode === 'special' ? 'SET' : undefined}
        linkedEntityId={pickerRequest?.mode === 'special' ? createdSetId : undefined}
        productIds={pickerRequest?.mode === 'content' ? allPieceItems.map((i) => i.productId).filter(Boolean) : undefined}
        scopedProducts={pickerRequest?.mode === 'content' ? scopedCoverProducts : undefined}
        initialColorId={
          pickerRequest?.mode === 'content'
            ? setColorsValue?.[pickerRequest.colorIndex]?.colorId
            : undefined
        }
        onConfirm={(assets) => {
          if (assets[0] && pickerRequest) {
            const assetIdField = pickerRequest.target === 'cover' ? 'coverAssetId' : 'secondaryCoverAssetId';
            const urlField = pickerRequest.target === 'cover' ? 'imageUrl' : 'secondaryImageUrl';
            setValue(`setColors.${pickerRequest.colorIndex}.${assetIdField}`, assets[0].id);
            setValue(`setColors.${pickerRequest.colorIndex}.${urlField}`, resolveMediaUrl(assets[0].storageKey));
            const scopeKey = `${pickerRequest.colorIndex}:${pickerRequest.target}`;
            setCoverContentScope((prev) => ({
              ...prev,
              [scopeKey]: pickerRequest.mode === 'content'
                ? allPieceItems.map((i) => i.productId).filter(Boolean)
                : [],
            }));
          }
          setPickerRequest(null);
        }}
      />

      {/* ── Drawer: crear/editar producto sin salir del set ──
          Angosto a propósito (`sm:max-w-2xl`, no el `90vw` genérico de los
          demás drawers): el wizard que contiene está pensado para una sola
          columna angosta (`max-w-xl`, ver `ProductForm.tsx`) — el marco debe
          adaptarse al tamaño del contenido, no al revés, para no dejar
          espacio en blanco alrededor. */}
      <Sheet open={productDrawer !== null} onOpenChange={(open) => !open && setProductDrawer(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="sr-only">
              {productDrawer?.productId ? 'Editar producto' : 'Nuevo producto'}
            </SheetTitle>
          </SheetHeader>
          {productDrawer && (
            <ProductForm
              embedded
              productId={productDrawer.productId}
              // Sin efecto mientras Visibilidad esté congelada en "Ambos" (a pedido,
              // 2026-07-28, ver `GeneralPrimarySection.tsx`) — se deja declarado para
              // que el flujo vuelva a preseleccionar "Solo Grupos" automáticamente en
              // cuanto se descongele el select.
              initialVisibility="GROUPS"
              onCancel={() => setProductDrawer(null)}
              onSaved={async (saved) => {
                await fetchProducts();
                if ('recommendedIndex' in productDrawer) {
                  setValue(`recommendedItems.${productDrawer.recommendedIndex}.productId`, saved.id);
                } else {
                  setValue(`blocks.${productDrawer.blockIndex}.options.${productDrawer.optionIndex}.productId`, saved.id);
                }
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
