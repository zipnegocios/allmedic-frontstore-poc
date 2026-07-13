import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { RuleForm } from '@/components/admin/RuleForm';
import { ArrowLeft } from 'lucide-react';

export default function NewRulePage() {
  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/reglas">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-[#111111]">Nueva Regla de Negocio</h1>
      </div>

      <RuleForm mode="create" />
    </div>
  );
}
