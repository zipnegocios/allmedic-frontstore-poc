'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { CompanySettingsForm } from '@/components/admin/quotes/CompanySettingsForm';
import { TaxPresetsPanel } from '@/components/admin/quotes/TaxPresetsPanel';
import { ValidityPresetsPanel } from '@/components/admin/quotes/ValidityPresetsPanel';

const SECTIONS = [
  { value: 'empresa', label: 'Datos de empresa' },
  { value: 'impuestos', label: 'Presets de impuestos' },
  { value: 'vigencia', label: 'Presets de vigencia' },
] as const;

export default function AdminConfiguracionPage() {
  const [section, setSection] = useState<string>('empresa');

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
      </Tabs>
    </div>
  );
}
