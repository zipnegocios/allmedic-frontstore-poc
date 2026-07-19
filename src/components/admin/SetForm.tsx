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
import { resolveMediaUrl } from '@/lib/media';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import ProductForm from '@/components/admin/ProductForm';
import { RuleForm } from '@/components/admin/RuleForm';
import { FloatingSaveButton, type FloatingSaveStatus } from '@/components/admin/FloatingSaveButton';
import {
  SetFormSchema,
  type SetFormData,
  type SetGroup,
  type Brand,
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
import { PiecesSection } from '@/components/admin/set-form/PiecesSection';
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
  const [groups, setGroups] = useState<SetGroup[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pieceComboOpen, setPieceComboOpen] = useState<number | null>(null);

  // Drawer de producto (crear pieza nueva / editar pieza existente sin salir del set)
  const [productDrawer, setProductDrawer] = useState<{ productId?: string; targetIndex: number } | null>(null);

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

  function buildSetPayload(data: SetFormData) {
    return {
      ...data,
      setGroupId: data.setGroupId || null,
      brandId: data.brandId || null,
      priceManual: manualPriceEnabled ? (data.priceManual || null) : null,
      priceManualSale: manualPriceEnabled ? (data.priceManualSale || null) : null,
      manualDiscountEnd: manualPriceEnabled ? (data.manualDiscountEnd || null) : null,
      items: data.items.map((item, idx) => ({ ...item, sortOrder: idx })),
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
                  groups={groups}
                  brands={brands}
                  onOpenPicker={() => setPickerOpen(true)}
                />
              )}

              {currentStep.id === 'pieces' && (
                <PiecesSection
                  control={control}
                  register={register}
                  errors={errors}
                  fields={fields}
                  items={items}
                  products={products}
                  append={append}
                  remove={remove}
                  pieceComboOpen={pieceComboOpen}
                  setPieceComboOpen={setPieceComboOpen}
                  onOpenProductDrawer={setProductDrawer}
                  pricePreview={pricePreview}
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
              watch={watch}
              groups={groups}
              brands={brands}
              onOpenPicker={() => setPickerOpen(true)}
            />

            <PiecesSection
              control={control}
              register={register}
              errors={errors}
              fields={fields}
              items={items}
              products={products}
              append={append}
              remove={remove}
              pieceComboOpen={pieceComboOpen}
              setPieceComboOpen={setPieceComboOpen}
              onOpenProductDrawer={setProductDrawer}
              pricePreview={pricePreview}
            />

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
