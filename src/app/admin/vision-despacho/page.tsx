import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAdminPage } from '@/lib/admin-auth';
import { getScopeContext } from '@/lib/permissions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, PackageCheck, ClipboardList, Truck, Bell, Tag,
  CircleDot, ArrowRight, Compass,
} from 'lucide-react';

const PIPELINE_STAGES = [
  { label: 'En Preparación', description: 'Venta cerrada, aún no ingresa a la cola de despacho.' },
  { label: 'Picking / Packing', description: 'El equipo de despacho arma físicamente el pedido.' },
  { label: 'Listo para Despacho', description: 'Empacado y etiquetado, a la espera de transportista.' },
  { label: 'Despachado', description: 'El pedido salió del centro de distribución.' },
  { label: 'Entregado', description: 'Confirmación de entrega al cliente final.' },
];

/**
 * Página de visión futura (Fase 9 del plan RBAC) — puramente descriptiva, sin ninguna
 * funcionalidad operativa real de Despachador (decisión del plan: fuera de alcance de
 * esta fase, solo el cimiento del rol como enum + esta página). Fuera del sidebar/bottom
 * nav estándar, solo Admin, acceso directo por URL.
 */
export default async function VisionDespachoPage() {
  const session = await requireAdminPage();
  const userId = (session.user as { id?: string })?.id;
  const scopeCtx = userId ? await getScopeContext(userId) : null;
  if (scopeCtx?.role !== 'ADMIN') {
    redirect('/admin');
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Volver al panel
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="bg-[#111111] p-2.5 rounded-lg">
            <Compass className="w-5 h-5 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-bold text-[#111111]">Visión: Módulo de Despacho</h1>
        </div>
        <div className="flex items-center gap-2 mb-8">
          <Badge variant="secondary">Roadmap — no implementado</Badge>
          <span className="text-sm text-gray-500">Solo visible para Admin</span>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="w-5 h-5 text-gray-400" />
              Recepción de ventas cerradas
            </CardTitle>
            <CardDescription>
              Cuando una cotización pasa a estado Despachado (o equivalente), el módulo de
              Despachador la recibiría automáticamente en su cola de trabajo — sin que el
              equipo de Ventas o Catálogo tenga que intervenir manualmente.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PackageCheck className="w-5 h-5 text-gray-400" />
              Hoja de ruta de estados (solo lectura)
            </CardTitle>
            <CardDescription>
              El rol Despachador vería el estado operativo de cada pedido en una hoja de
              ruta de solo lectura, avanzando por estas etapas:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1">
              {PIPELINE_STAGES.map((stage, idx) => (
                <div key={stage.label} className="flex items-start gap-3">
                  <div className="flex flex-col items-center pt-0.5">
                    <CircleDot className="w-4 h-4 text-gray-300" />
                    {idx < PIPELINE_STAGES.length - 1 && <div className="w-px h-8 bg-gray-200 my-1" />}
                  </div>
                  <div className="pb-4">
                    <p className="font-medium text-sm text-[#111111]">{stage.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{stage.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Truck className="w-5 h-5 text-gray-400" />
              Integración logística
            </CardTitle>
            <CardDescription>
              Piezas de integración previstas para cuando este módulo se construya:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <Tag className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <span>Generación de etiquetas de envío por pedido.</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <span>Tracking del transportista asociado a cada despacho.</span>
              </li>
              <li className="flex items-start gap-2">
                <Bell className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <span>Notificaciones automáticas al cliente en cada cambio de estado.</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <p className="text-xs text-gray-400 mt-8 text-center">
          Un usuario con rol Despachador no ve ningún módulo activo hoy — esta página describe
          el flujo futuro, no implementa ninguna de estas piezas.
        </p>
      </div>
    </div>
  );
}
