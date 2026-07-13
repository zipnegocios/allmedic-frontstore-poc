'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CompanySettingsForm } from '@/components/admin/quotes/CompanySettingsForm';
import { TaxPresetsPanel } from '@/components/admin/quotes/TaxPresetsPanel';
import { ValidityPresetsPanel } from '@/components/admin/quotes/ValidityPresetsPanel';

export default function AdminConfiguracionPage() {
  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#111111]">Configuración</h1>
        <p className="text-sm text-gray-500 mt-1">Datos de empresa y presets usados por el módulo de cotizaciones</p>
      </div>

      <Tabs defaultValue="empresa">
        <TabsList>
          <TabsTrigger value="empresa">Datos de empresa</TabsTrigger>
          <TabsTrigger value="impuestos">Presets de impuestos</TabsTrigger>
          <TabsTrigger value="vigencia">Presets de vigencia</TabsTrigger>
        </TabsList>
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
