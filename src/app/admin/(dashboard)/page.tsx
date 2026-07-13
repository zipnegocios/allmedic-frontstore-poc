import { db } from '@/db';
import { products, productVariants, leads } from '@/db/schema';
import { sql, eq, and, gte } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, ShoppingCart, AlertTriangle, TrendingUp } from 'lucide-react';
import { LEAD_STATUS_LABELS } from '@/lib/lead-status';

export default async function AdminDashboardPage() {
  await requireAdmin();

  const [productCount, leadCount, lowStockCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(products).where(eq(products.isActive, true)),
    db.select({ count: sql<number>`count(*)` }).from(leads).where(eq(leads.status, 'SENT')),
    db.select({ count: sql<number>`count(*)` })
      .from(productVariants)
      .where(and(
        gte(productVariants.stock, 0),
        sql`${productVariants.stock} < ${productVariants.minStock}`
      )),
  ]);

  const recentLeads = await db.select().from(leads).orderBy(sql`${leads.createdAt} desc`).limit(5);

  const stats = [
    { label: 'Productos activos', value: productCount[0]?.count ?? 0, icon: Package, color: 'bg-blue-500' },
    { label: 'Pedidos pendientes', value: leadCount[0]?.count ?? 0, icon: ShoppingCart, color: 'bg-green-500' },
    { label: 'Stock bajo', value: lowStockCount[0]?.count ?? 0, icon: AlertTriangle, color: 'bg-red-500' },
    { label: 'Ventas hoy', value: 0, icon: TrendingUp, color: 'bg-purple-500' },
  ];

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold text-[#111111] mb-8">Panel principal</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
