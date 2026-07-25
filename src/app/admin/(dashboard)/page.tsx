import Link from 'next/link';
import { db } from '@/db';
import { products, leads, quotes } from '@/db/schema';
import { sql, eq, and, isNull } from 'drizzle-orm';
import { requireAdminPage } from '@/lib/admin-auth';
import { getScopeContext, resolveReadScopeFilter } from '@/lib/permissions';
import { getProductivityStatsForUser } from '@/lib/productivity-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Package, ShoppingCart, TrendingUp, FileText, Gauge } from 'lucide-react';
import { LEAD_STATUS_LABELS } from '@/lib/lead-status';

export default async function AdminDashboardPage() {
  const session = await requireAdminPage();
  const userId = (session.user as { id?: string })?.id;
  const scopeCtx = userId ? await getScopeContext(userId) : null;

  if (scopeCtx?.role === 'SALES') {
    return <SalesDashboard scopeCtx={scopeCtx} />;
  }
  if (scopeCtx?.role === 'CATALOG_MANAGER' && userId) {
    return <CatalogManagerDashboard userId={userId} />;
  }
  return <DefaultDashboard />;
}

async function DefaultDashboard() {
  const [productCount, leadCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(products).where(eq(products.isActive, true)),
    db.select({ count: sql<number>`count(*)` }).from(leads).where(eq(leads.status, 'SENT')),
  ]);

  const recentLeads = await db.select().from(leads).orderBy(sql`${leads.createdAt} desc`).limit(5);

  const stats = [
    { label: 'Productos activos', value: productCount[0]?.count ?? 0, icon: Package, color: 'bg-blue-500' },
    { label: 'Pedidos pendientes', value: leadCount[0]?.count ?? 0, icon: ShoppingCart, color: 'bg-green-500' },
    { label: 'Ventas hoy', value: 0, icon: TrendingUp, color: 'bg-purple-500' },
  ];

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold text-[#111111] mb-8">Panel principal</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{stat.label}</p>
                    <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <Icon className="w-6 h-6 text-white" strokeWidth={1.5} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimos pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          {recentLeads.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay pedidos recientes</p>
          ) : (
            <div className="space-y-4">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium">{lead.customerName}</p>
                    <p className="text-sm text-gray-500">{lead.customerCity} • {lead.totalItems} artículos</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${lead.subtotal}</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                      {LEAD_STATUS_LABELS[lead.status] || lead.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Dashboard de Ventas (Fase 5 del plan RBAC): resumen de sus propias cotizaciones,
 * respetando el scope OWN/ALL (decisión 4). */
async function SalesDashboard({ scopeCtx }: { scopeCtx: NonNullable<Awaited<ReturnType<typeof getScopeContext>>> }) {
  const salesAgentId = resolveReadScopeFilter(scopeCtx);
  const conditions = [isNull(quotes.deletedAt)];
  if (salesAgentId) conditions.push(eq(quotes.salesAgentId, salesAgentId));

  const [draftCount, finalCount, recentQuotes] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(quotes).where(and(...conditions, eq(quotes.status, 'DRAFT'))),
    db.select({ count: sql<number>`count(*)` }).from(quotes).where(and(...conditions, eq(quotes.status, 'FINAL'))),
    db.select().from(quotes).where(and(...conditions)).orderBy(sql`${quotes.createdAt} desc`).limit(5),
  ]);

  const stats = [
    { label: 'Cotizaciones en borrador', value: draftCount[0]?.count ?? 0, icon: FileText, color: 'bg-blue-500' },
    { label: 'Cotizaciones definitivas', value: finalCount[0]?.count ?? 0, icon: TrendingUp, color: 'bg-green-500' },
  ];

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold text-[#111111] mb-2">Panel de Ventas</h1>
      <p className="text-sm text-gray-500 mb-8">
        {scopeCtx.scopeLevel === 'OWN' ? 'Mostrando solo tus cotizaciones asignadas.' : 'Mostrando todas las cotizaciones (edición limitada a las propias).'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{stat.label}</p>
                    <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <Icon className="w-6 h-6 text-white" strokeWidth={1.5} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cotizaciones recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentQuotes.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay cotizaciones recientes</p>
          ) : (
            <div className="space-y-4">
              {recentQuotes.map((quote) => (
                <div key={quote.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium">{quote.customerName}</p>
                    <p className="text-sm text-gray-500">{quote.quoteNumber || 'Sin número'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${quote.total}</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                      {quote.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const CATALOG_MANAGER_STATUS_COLORS: Record<'green' | 'yellow' | 'red', string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
};

const CATALOG_MANAGER_STATUS_LABELS: Record<'green' | 'yellow' | 'red', string> = {
  green: 'Cumple la meta',
  yellow: 'Por debajo de la meta',
  red: 'Muy por debajo de la meta',
};

/** Dashboard del Gestor del Catálogo (Fase 5+8 del plan RBAC): resumen del catálogo +
 * semáforo de productividad del día contra su meta (`productivity_targets.daily_target`).
 * El visor completo con filtros día/semana/mes vive en `/admin/productividad`. */
async function CatalogManagerDashboard({ userId }: { userId: string }) {
  const [productCount] = await db.select({ count: sql<number>`count(*)` }).from(products).where(eq(products.isActive, true));
  const productivity = await getProductivityStatsForUser(userId, 'day');

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold text-[#111111] mb-8">Panel del Catálogo</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Productos activos</p>
                <p className="text-3xl font-bold mt-1">{productCount?.count ?? 0}</p>
              </div>
              <div className="bg-blue-500 p-3 rounded-lg">
                <Package className="w-6 h-6 text-white" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Productividad de hoy</CardTitle>
              <Badge className={`${CATALOG_MANAGER_STATUS_COLORS[productivity.status]} text-white border-none`}>
                {CATALOG_MANAGER_STATUS_LABELS[productivity.status]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-gray-600">{productivity.totalItems} / {productivity.periodTarget} ítems</span>
                <span className="font-semibold">{productivity.compliancePct}%</span>
              </div>
              <Progress value={Math.min(productivity.compliancePct, 100)} className="h-2.5" />
            </div>
            <Link href="/admin/productividad" className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5" />
              Ver detalle completo
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
