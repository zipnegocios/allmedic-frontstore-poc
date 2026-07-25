import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAdminPage } from '@/lib/admin-auth';
import { getScopeContext } from '@/lib/permissions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, MessageCircle, ShoppingBag, RefreshCw, Compass,
  Instagram, Facebook, Mail, MessageSquare,
} from 'lucide-react';

const CHANNELS = [
  { label: 'WhatsApp', icon: MessageCircle },
  { label: 'Instagram', icon: Instagram },
  { label: 'Facebook', icon: Facebook },
  { label: 'TikTok', icon: MessageSquare },
  { label: 'Correo', icon: Mail },
];

const CATALOG_SYNC_TARGETS = [
  { label: 'Meta Commerce Manager', note: null },
  { label: 'Google Merchant Center', note: null },
  { label: 'WhatsApp Business Catalog', note: null },
  { label: 'MercadoLibre Ecuador', note: 'opcional' },
];

/**
 * Página de visión futura (Fase 9 del plan RBAC) — puramente descriptiva, sin ninguna
 * funcionalidad de Marketing real (panel omnicanal, integraciones, sincronización de
 * catálogos). Fuera del sidebar/bottom nav estándar, solo Admin, acceso directo por URL.
 */
export default async function VisionMarketingPage() {
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
          <h1 className="text-3xl font-bold text-[#111111]">Visión: Módulo de Marketing</h1>
        </div>
        <div className="flex items-center gap-2 mb-8">
          <Badge variant="secondary">Roadmap — no implementado</Badge>
          <span className="text-sm text-gray-500">Solo visible para Admin</span>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageCircle className="w-5 h-5 text-gray-400" />
              Panel de comunicaciones omnicanal
            </CardTitle>
            <CardDescription>
              Bandeja unificada de conversaciones con clientes a través de los canales que
              hoy maneja el negocio por separado:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {CHANNELS.map((channel) => {
                const Icon = channel.icon;
                return (
                  <div key={channel.label} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                    <Icon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">{channel.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShoppingBag className="w-5 h-5 text-gray-400" />
              Social selling
            </CardTitle>
            <CardDescription>
              Convertir una conversación en una venta sin salir del chat:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>Acción rápida de "Crear cotización" directamente desde el hilo de chat.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>Tarjetas de producto enviables dentro de la conversación, con precio y disponibilidad en vivo.</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <RefreshCw className="w-5 h-5 text-gray-400" />
              Sincronización de catálogos externos
            </CardTitle>
            <CardDescription>
              Publicar el catálogo de AllMedic directamente en plataformas externas, sin
              mantenerlo por duplicado:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-700">
              {CATALOG_SYNC_TARGETS.map((target) => (
                <li key={target.label} className="flex items-center gap-2">
                  <span className="text-gray-400">•</span>
                  <span>{target.label}</span>
                  {target.note && <Badge variant="outline" className="text-xs">{target.note}</Badge>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <p className="text-xs text-gray-400 mt-8 text-center">
          El rol Marketing todavía no existe como valor real del enum de roles — esta página
          describe el flujo futuro, no implementa ninguna de estas piezas.
        </p>
      </div>
    </div>
  );
}
