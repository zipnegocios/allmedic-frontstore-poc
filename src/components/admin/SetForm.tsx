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
import { ColorModeGate } from '@/components/admin/set-form/ColorModeGate';
import { PairedColorAccordion } from '@/components/admin/set-form/PairedColorAccordion';
import { MixedColorAccordion } from '@/components/admin/set-form/MixedColorAccordion';
import { BlockSection } from '@/components/admin/set-form/BlockSection';
import { RecommendedItemsSection } from '@/components/admin/set-form/RecommendedItemsSection';
import { PriceSection } from '@/components/admin/set-form/PriceSection';
import { RulesSection } from '@/components/admin/set-form/RulesSection';
import { buildSetValidationSummary } from '@/components/admin/set-form/validation-summary';

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
  const [showValidationBanner, setShowValidationBanner] = useState(false);
  const [pickerRequest, setPickerRequest] = useState<{ target: 'cover' | 'secondaryCover'; mode: 'special' | 'content' } | null>(null);
  // Snapshot de productIds vigentes al momento de elegir una portada en modo
  // "Portadas del contenido" — si luego se quita del set alguno de esos
  // productos, avisamos que la portada podría ya no ser válida (Fase 2.4,
  // PLAN-ajustes-admin-sets.md). No identifica el producto exacto del asset
  // elegido (eso requeriría una consulta extra a media_links por selección),
  // así que el aviso es conservador: se dispara si el producto quitado
  // formaba parte del alcance de la galería consultada, no solo si es
  // certeramente el dueño de la imagen.
  const [coverContentScope, setCoverContentScope] = useState<{ cover?: string[]; secondaryCover?: string[] }>({});
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
    trigger,
    formState: { errors },
  } = useForm<SetFormData>({
    resolver: zodResolver(SetFormSchema) as never,
    defaultValues: initialData || {
      name: '',
      slug: '',
      description: '',
      imageUrl: '',
      secondaryImageUrl: '',
      isActive: true,
      isFeatured: false,
      blocks: [
        { blockCode: 'A', quantityPerSet: 1, options: [{ productId: '' }, { productId: '' }] },
        { blockCode: 'B', quantityPerSet: 1, options: [{ productId: '' }, { productId: '' }] },
      ],
      recommendedItems: [],
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
  // color (paridad/combos) y por el chequeo de duplicados entre bloques.
  const allPieceItems = useMemo(
    () => [
      ...blocks.flatMap((b) => b.options.map((o) => ({ productId: o.productId, quantityPerSet: b.quantityPerSet }))),
      ...recommendedItems.map((r) => ({ productId: r.productId, quantityPerSet: 1 })),
    ],
    [blocks, recommendedItems]
  );
  const blockOnlyItems = useMemo(
    () => blocks.flatMap((b) => b.options.map((o) => ({ productId: o.productId, quantityPerSet: b.quantityPerSet }))),
    [blocks]
  );

  /** Quita una pieza recomendada y avisa si podría haber sido la fuente de alguna portada
   * elegida en modo "Portadas del contenido" (Fase 2.4). */
  function handleRemoveRecommended(index: number) {
    const removedProductId = recommendedItems[index]?.productId;
    removeRecommended(index);
    if (!removedProductId) return;
    const affected = (['cover', 'secondaryCover'] as const).filter((slot) =>
      coverContentScope[slot]?.includes(removedProductId)
    );
    if (affected.length > 0) {
      toast.warning(
        'Quitaste una pieza cuya galería pudo haber aportado la portada actual — revisa que la portada primaria y secundaria sigan siendo válidas antes de guardar.'
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

  const nameValue = watch('name');
  const slugValue = watch('slug');
  useEffect(() => {
    if (!setId && nameValue && !slugValue) {
      setValue('slug', nameValue.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
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
      toast.success(createdSetId ? 'Set actualizado' : 'Set creado');
      router.push('/admin/sets');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
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
    return (
      <div className="space-y-4">
        <BlockSection
          blockIndex={0}
          blockCode="A"
          control={control}
          register={register}
          errors={errors}
          products={products}
          optionComboOpen={optionComboOpen}
          setOptionComboOpen={setOptionComboOpen}
          onOpenProductDrawer={setProductDrawer}
          selectedProductIds={usedProductIds}
          optionProductIds={[blocks[0]?.options[0]?.productId ?? '', blocks[0]?.options[1]?.productId ?? '']}
        />
        <BlockSection
          blockIndex={1}
          blockCode="B"
          control={control}
          register={register}
          errors={errors}
          products={products}
          optionComboOpen={optionComboOpen}
          setOptionComboOpen={setOptionComboOpen}
          onOpenProductDrawer={setProductDrawer}
          selectedProductIds={usedProductIds}
          optionProductIds={[blocks[1]?.options[0]?.productId ?? '', blocks[1]?.options[1]?.productId ?? '']}
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

  function goToStep(index: number) {
    if (!canNavigateToStep(index, maxVisitedStepIndex)) return;
    setCurrentStepIndex(index);
  }

  async function goToNextStep() {
    const stepFields = currentStep.fields;
    const valid = stepFields.length === 0 ? true : await trigger(stepFields as (keyof SetFormData)[]);
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
              {currentStep.id === 'general' && (
                <GeneralSection
                  register={register}
                  control={control}
                  errors={errors}
                  watch={watch}
                  hasPieces={allPieceItems.some((i) => i.productId)}
                  onOpenPicker={(target, mode) => setPickerRequest({ target, mode })}
                />
              )}

              {currentStep.id === 'color-mode' && (
                <ColorModeGate value={colorMode} onChange={handleColorModeChange} nameFilled={Boolean(nameValue?.trim())} />
              )}

              {currentStep.id === 'pieces' && renderBlocksAndRecommended()}

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
              watch={watch}
              hasPieces={allPieceItems.some((i) => i.productId)}
              onOpenPicker={(target, mode) => setPickerRequest({ target, mode })}
            />

            <ColorModeGate value={colorMode} onChange={handleColorModeChange} nameFilled={Boolean(nameValue?.trim())} />

            {colorMode && renderBlocksAndRecommended()}

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
        segments={slugValue?.trim() ? [sanitizeCodeSegment(slugValue.trim()), COVER_SEGMENT] : []}
        keyPrefix={pickerRequest?.mode === 'special' && slugValue?.trim() ? `sets/${sanitizeCodeSegment(slugValue.trim())}/${COVER_SEGMENT}/` : undefined}
        linkedEntityType={pickerRequest?.mode === 'special' ? 'SET' : undefined}
        linkedEntityId={pickerRequest?.mode === 'special' ? createdSetId : undefined}
        productIds={pickerRequest?.mode === 'content' ? allPieceItems.map((i) => i.productId).filter(Boolean) : undefined}
        onConfirm={(assets) => {
          if (assets[0] && pickerRequest) {
            const assetIdField = pickerRequest.target === 'cover' ? 'coverAssetId' : 'secondaryCoverAssetId';
            const urlField = pickerRequest.target === 'cover' ? 'imageUrl' : 'secondaryImageUrl';
            setValue(assetIdField, assets[0].id);
            setValue(urlField, resolveMediaUrl(assets[0].storageKey));
            setCoverContentScope((prev) => ({
              ...prev,
              [pickerRequest.target]: pickerRequest.mode === 'content'
                ? allPieceItems.map((i) => i.productId).filter(Boolean)
                : undefined,
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
