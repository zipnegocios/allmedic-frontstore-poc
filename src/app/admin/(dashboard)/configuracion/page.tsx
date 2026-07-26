'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Compass, ChevronRight } from 'lucide-react';
import { CompanySettingsForm } from '@/components/admin/quotes/CompanySettingsForm';
import { TaxPresetsPanel } from '@/components/admin/quotes/TaxPresetsPanel';
import { ValidityPresetsPanel } from '@/components/admin/quotes/ValidityPresetsPanel';
import { EmailEventsPanel } from '@/components/admin/email/EmailEventsPanel';
import { PaymentModuleToggle } from '@/components/admin/payments/PaymentModuleToggle';
import { usePermissions } from '@/hooks/usePermissions';

const SECTIONS = [
  { value: 'empresa', label: 'Datos de empresa' },
  { value: 'impuestos', label: 'Presets de impuestos' },
  { value: 'vigencia', label: 'Presets de vigencia' },
  { value: 'correos', label: 'Correos' },
  { value: 'pagos', label: 'Pagos' },
] as const;

export default function AdminConfiguracionPage() {
  const [section, setSection] = useState<string>('empresa');
  const { isAdmin } = usePermissions();

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#111111]">Configuración</h1>
        <p className="text-sm text-gray-500 mt-1">Datos de empresa y presets usados por el módulo de cotizaciones</p>
      </div>

      <Tabs value={section} onValueChange={setSection}>
        <TabsList className="hidden md:inline-flex">
          {SECTIONS.map((s) => (
            <TabsTrigger key={s.value} value={s.value}>{s.label}</TabsTrigger>
          ))}
        </TabsList>

        {/* Navegación entre secciones en mobile — TabsList desborda a 390px con 3 pestañas de texto largo */}
        <div className="md:hidden">
          <Select value={section} onValueChange={setSection}>
            <SelectTrigger className="w-full min-h-11" aria-label="Sección de configuración">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SECTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="empresa" className="mt-6">
          <CompanySettingsForm />
        </TabsContent>
        <TabsContent value="impuestos" className="mt-6">
          <TaxPresetsPanel />
        </TabsContent>
        <TabsContent value="vigencia" className="mt-6">
          <ValidityPresetsPanel />
        </TabsContent>
        <TabsContent value="correos" className="mt-6">
          <EmailEventsPanel />
        </TabsContent>
        <TabsContent value="pagos" className="mt-6">
          <PaymentModuleToggle />
        </TabsContent>
      </Tabs>

      {isAdmin && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Roadmap</h2>
          <Card>
            <CardContent className="p-0 divide-y divide-gray-100">
              <Link
                href="/admin/vision-despacho"
                className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Compass className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">Visión: Módulo de Despacho</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </Link>
              <Link
                href="/admin/vision-marketing"
                className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Compass className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">Visión: Módulo de Marketing</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
