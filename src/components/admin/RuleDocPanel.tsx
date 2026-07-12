'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RULE_DOCS, HIERARCHY_DOC } from '@/lib/rules-engine/docs';
import type { RuleTypeKey } from '@/lib/rule-config-schemas';
import { BookOpen, AlertTriangle, Info, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type Scope = 'GLOBAL' | 'BRAND' | 'SET_GROUP' | 'SET' | 'PRODUCT';

const SCOPE_LABELS: Record<Scope, string> = {
  GLOBAL: 'Global',
  BRAND: 'Marca',
  SET_GROUP: 'Grupo de Sets',
  SET: 'Set específico',
  PRODUCT: 'Producto específico',
};

const CATALOG_LABELS: Record<'INDIVIDUAL' | 'CORPORATE', string> = {
  INDIVIDUAL: 'Catálogo individual',
  CORPORATE: 'Catálogo corporativo',
};

interface RuleDocPanelProps {
  ruleType: RuleTypeKey;
  scope: Scope;
  onApplyExample: (config: Record<string, unknown>) => void;
}

export function RuleDocPanel({ ruleType, scope, onApplyExample }: RuleDocPanelProps) {
  const [collapsed, setCollapsed] = useState(true);
  const doc = RULE_DOCS[ruleType];
  const scopeSupported = doc.supportedScopes.includes(scope as never);

  return (
    <Card className="lg:sticky lg:top-6">
      <CardContent className="p-6">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center justify-between gap-2 lg:pointer-events-none lg:cursor-default"
        >
          <h3 className="font-semibold flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Documentación
          </h3>
          <span className="lg:hidden text-gray-400">
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </span>
        </button>

        <div className={cn('mt-4 space-y-5', collapsed && 'hidden lg:block')}>
          {/* Título + resumen */}
          <div>
            <h4 className="text-lg font-bold text-[#111111]">{doc.title}</h4>
            <p className="text-sm text-gray-600 mt-1">{doc.summary}</p>
          </div>

          {/* Badges de catálogo aplicable */}
          <div className="flex flex-wrap gap-2">
            {doc.appliesTo.length === 0 ? (
              <Badge variant="destructive">No tiene efecto todavía</Badge>
            ) : (
              doc.appliesTo.map((c) => (
                <Badge key={c} variant="secondary">{CATALOG_LABELS[c]}</Badge>
              ))
            )}
          </div>

          {/* Advertencia de ámbito no soportado */}
          {!scopeSupported && (
            <div className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                El ámbito <strong>{SCOPE_LABELS[scope]}</strong> aún no tiene efecto real para este tipo de regla.
                {doc.supportedScopes.length > 0 && (
                  <> Ámbitos con efecto confirmado: {doc.supportedScopes.map((s) => SCOPE_LABELS[s as Scope]).join(', ')}.</>
                )}
              </span>
            </div>
          )}

          {/* Detalle */}
          <p className="text-sm text-gray-700 leading-relaxed">{doc.detail}</p>

          {/* Comportamiento por defecto */}
          <div className="text-sm bg-[#F5F5F7] rounded-lg p-3">
            <span className="font-medium text-[#111111]">Sin regla activa: </span>
            <span className="text-gray-600">{doc.defaultBehavior}</span>
          </div>

          {/* Campos de configuración */}
          {doc.fields.length > 0 && (
            <div>
              <h5 className="text-sm font-semibold mb-2">Campos de configuración</h5>
              <div className="space-y-3">
                {doc.fields.map((field) => (
                  <div key={field.key} className="text-sm">
                    <p className="font-medium text-[#111111]">{field.label}</p>
                    <p className="text-gray-600">{field.description}</p>
                    {field.options && (
                      <ul className="mt-1 space-y-1 pl-3 border-l-2 border-[#E5E5E5]">
                        {field.options.map((opt) => (
                          <li key={opt.value} className="text-xs">
                            <span className="font-medium text-[#111111]">{opt.label}:</span>{' '}
                            <span className="text-gray-500">{opt.description}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ejemplos aplicables */}
          {doc.examples.length > 0 && (
            <div>
              <h5 className="text-sm font-semibold mb-2 flex items-center gap-1">
                <Lightbulb className="w-4 h-4" />
                Ejemplos
              </h5>
              <div className="space-y-2">
                {doc.examples.map((ex) => (
                  <div key={ex.title} className="border border-[#E5E5E5] rounded-lg p-3">
                    <p className="text-sm font-medium text-[#111111]">{ex.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{ex.explanation}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => onApplyExample(ex.config)}
                    >
                      Usar este ejemplo
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interacciones */}
          {doc.interactions.length > 0 && (
            <div className="space-y-2">
              {doc.interactions.map((text, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Advertencias */}
          {doc.warnings.length > 0 && (
            <div className="space-y-2">
              {doc.warnings.map((text, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Jerarquía (bloque común, siempre visible) */}
          <div className="border-t border-[#E5E5E5] pt-4">
            <h5 className="text-sm font-semibold mb-1">{HIERARCHY_DOC.title}</h5>
            <p className="text-xs text-gray-500 leading-relaxed">{HIERARCHY_DOC.detail}</p>
            <p className="text-xs text-gray-500 leading-relaxed mt-2">{HIERARCHY_DOC.validityWindows}</p>
            <p className="text-xs text-gray-500 leading-relaxed mt-2">{HIERARCHY_DOC.multiInstance}</p>
            <p className="text-xs text-gray-500 leading-relaxed mt-2">{HIERARCHY_DOC.conflictDetection}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
