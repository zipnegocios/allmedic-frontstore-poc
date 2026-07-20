'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { RULE_TYPE_LABELS, type RuleTypeKey } from '@/lib/rule-config-schemas';
import type { SetRuleRow } from './schema';

interface RulesSectionProps {
  setId: string | undefined;
  rulesLoading: boolean;
  rulesByType: Map<RuleTypeKey, SetRuleRow[]>;
  onNewRule: () => void;
  onEditRule: (ruleId: string) => void;
}

/**
 * Contenido de "Reglas de este set": panel embebido que lista las reglas de
 * ámbito Set (editables aquí) más las heredadas (solo lectura, con link al
 * panel de reglas). Extraído para reutilizarse sin cambios tanto en la vista
 * desktop (Card secuencial) como en el paso 4 del wizard mobile.
 *
 * El condicional "el set debe existir primero" (`!setId`) es exactamente el
 * mismo que ya gobernaba esta sección en desktop — no se inventa una regla
 * nueva, solo se reutiliza tal cual en ambas presentaciones.
 */
export function RulesSection({ setId, rulesLoading, rulesByType, onNewRule, onEditRule }: RulesSectionProps) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Reglas de este set</h3>
            <p className="text-xs text-gray-500">
              Reglas de ámbito Set de este set, más las heredadas (Global, Marca y Producto de sus piezas).
            </p>
          </div>
          {setId && (
            <Button type="button" variant="outline" onClick={onNewRule}>
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
        ) : rulesByType.size === 0 ? (
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
                        <Button type="button" variant="ghost" size="sm" onClick={() => onEditRule(r.id)}>
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
  );
}
