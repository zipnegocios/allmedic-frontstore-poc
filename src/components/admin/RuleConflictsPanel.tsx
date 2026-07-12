'use client';

import Link from 'next/link';
import { AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { RuleConflict } from '@/lib/rules-engine';

const SEVERITY_STYLES: Record<RuleConflict['severity'], { icon: typeof AlertCircle; className: string }> = {
  ERROR: { icon: AlertCircle, className: 'bg-red-50 border-red-200 text-red-800' },
  WARNING: { icon: AlertTriangle, className: 'bg-amber-50 border-amber-200 text-amber-800' },
  INFO: { icon: Info, className: 'bg-blue-50 border-blue-200 text-blue-700' },
};

interface RuleConflictsPanelProps {
  conflicts: RuleConflict[];
  checking: boolean;
  warningsAcknowledged: boolean;
  onAcknowledgeChange: (checked: boolean) => void;
}

export function RuleConflictsPanel({ conflicts, checking, warningsAcknowledged, onAcknowledgeChange }: RuleConflictsPanelProps) {
  const errors = conflicts.filter((c) => c.severity === 'ERROR');
  const warnings = conflicts.filter((c) => c.severity === 'WARNING');
  const infos = conflicts.filter((c) => c.severity === 'INFO');

  if (checking && conflicts.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 mt-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Verificando conflictos con otras reglas...
      </div>
    );
  }

  if (conflicts.length === 0) return null;

  return (
    <div className="space-y-2 mt-4">
      <h5 className="text-sm font-semibold">Conflictos detectados</h5>
      {[...errors, ...warnings, ...infos].map((conflict, idx) => {
        const { icon: Icon, className } = SEVERITY_STYLES[conflict.severity];
        return (
          <div key={idx} className={`flex items-start gap-2 text-sm border rounded-lg p-3 ${className}`}>
            <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{conflict.message}</span>
              {conflict.conflictingRuleId && (
                <Link href={`/admin/rules/${conflict.conflictingRuleId}`} className="ml-2 underline font-medium">
                  Ver regla
                </Link>
              )}
            </div>
          </div>
        );
      })}

      {errors.length === 0 && warnings.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id="ack-warnings"
            checked={warningsAcknowledged}
            onCheckedChange={(checked) => onAcknowledgeChange(checked === true)}
          />
          <Label htmlFor="ack-warnings" className="text-sm font-normal">
            Entiendo el conflicto y deseo guardar la regla igualmente
          </Label>
        </div>
      )}
    </div>
  );
}
