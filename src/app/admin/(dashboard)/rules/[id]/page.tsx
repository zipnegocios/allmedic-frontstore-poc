import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAdminRuleById } from '@/lib/admin-data-service';
import { Button } from '@/components/ui/button';
import { RuleForm } from '@/components/admin/RuleForm';
import { ArrowLeft } from 'lucide-react';
import type { RuleTypeKey } from '@/lib/rule-config-schemas';

interface EditRulePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditRulePage({ params }: EditRulePageProps) {
  const { id } = await params;
  const rule = await getAdminRuleById(id);

  if (!rule) {
    notFound();
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/rules">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-[#111111]">{rule.name}</h1>
      </div>

      <RuleForm
        mode="edit"
        ruleId={rule.id}
        initial={{
          name: rule.name,
          ruleType: rule.ruleType as RuleTypeKey,
          scope: rule.scope as 'GLOBAL' | 'BRAND' | 'SET_GROUP' | 'SET' | 'PRODUCT',
          scopeId: rule.scopeId,
          config: rule.config as Record<string, unknown>,
          isActive: rule.isActive ?? true,
          priority: rule.priority ?? 0,
        }}
      />
    </div>
  );
}
