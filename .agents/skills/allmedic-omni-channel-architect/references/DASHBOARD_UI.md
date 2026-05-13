# DASHBOARD_UI.md — Unified Inbox y Dashboard Admin

> Guía para construir el Dashboard Administrativo de Allmedic con Unified Inbox,
> usando Server Components por defecto y `'use client'` solo para el socket de chat en vivo.

---

## 1. Principios de Diseño

1. **Server Components por defecto**: Todas las páginas del dashboard son Server Components.
2. **'use client' solo para interacción en vivo**: El panel de chat en tiempo real es el único Client Component obligatorio.
3. **Data fetching en Server Components**: Usar Drizzle directamente en `page.tsx`.
4. **Mutaciones con Server Actions**: Usar `use server` para formularios y acciones.
5. **Reutilizar shadcn/ui**: El proyecto ya tiene 50+ componentes instalados.

---

## 2. Estructura de Rutas

```
src/app/
├── (admin)/                    # Route group: layout compartido
│   ├── admin/
│   │   ├── login/
│   │   │   └── page.tsx        # Login con credentials
│   │   ├── dashboard/
│   │   │   └── page.tsx        # KPIs, gráficos, overview
│   │   ├── inbox/
│   │   │   ├── page.tsx        # Server Component: lista de conversaciones
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Server Component: detalle de conversación
│   │   ├── products/
│   │   │   └── page.tsx        # CRUD de productos
│   │   ├── leads/
│   │   │   └── page.tsx        # Tabla de leads con filtros
│   │   ├── analytics/
│   │   │   └── page.tsx        # Gráficos de búsquedas, clicks, conversiones
│   │   └── settings/
│   │       └── page.tsx        # Configuración WA, IG, usuarios
│   └── layout.tsx              # Admin layout: sidebar + header
```

---

## 3. Admin Layout (`src/app/(admin)/layout.tsx`)

```tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/admin/login');
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar user={session.user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader user={session.user} />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

---

## 4. Unified Inbox — Lista de Conversaciones

### `src/app/(admin)/admin/inbox/page.tsx` (Server Component)

```tsx
import { db } from '@/db';
import { conversations, messages } from '@/db/schema/chats';
import { eq, desc, sql } from 'drizzle-orm';
import { ConversationList } from '@/components/admin/ConversationList';

export default async function InboxPage() {
  // Obtener conversaciones con conteo de mensajes no leídos
  const convs = await db.select({
    id: conversations.id,
    channel: conversations.channel,
    customerName: conversations.customerName,
    customerPhone: conversations.customerPhone,
    customerIgHandle: conversations.customerIgHandle,
    status: conversations.status,
    lastMessageAt: conversations.lastMessageAt,
    unreadCount: sql<number>`COUNT(CASE WHEN ${messages.direction} = 'inbound' THEN 1 END)`.as('unread_count'),
  })
  .from(conversations)
  .leftJoin(messages, eq(messages.conversationId, conversations.id))
  .groupBy(conversations.id)
  .orderBy(desc(conversations.lastMessageAt));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bandeja de Entrada</h1>
      <ConversationList conversations={convs} />
    </div>
  );
}
```

### `src/components/admin/ConversationList.tsx` (Server Component)

```tsx
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MessageCircle, Phone, Clock } from 'lucide-react';

interface ConversationItem {
  id: string;
  channel: string;
  customerName: string | null;
  customerPhone: string | null;
  customerIgHandle: string | null;
  status: string;
  lastMessageAt: Date | null;
  unreadCount: number;
}

export function ConversationList({ conversations }: { conversations: ConversationItem[] }) {
  return (
    <div className="bg-white rounded-lg border shadow-sm">
      {conversations.map((conv) => (
        <Link
          key={conv.id}
          href={`/admin/inbox/${conv.id}`}
          className="flex items-center gap-4 p-4 hover:bg-gray-50 border-b last:border-b-0 transition-colors"
        >
          {/* Icono de canal */}
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            conv.channel === 'whatsapp' ? 'bg-green-100 text-green-600' : 'bg-pink-100 text-pink-600'
          )}>
            {conv.channel === 'whatsapp' ? <Phone className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">
                {conv.customerName || conv.customerPhone || conv.customerIgHandle || 'Cliente'}
              </span>
              {conv.unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {conv.unreadCount}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="capitalize">{conv.channel}</span>
              <span>•</span>
              <span className={cn(
                conv.status === 'OPEN' ? 'text-yellow-600' :
                conv.status === 'CLOSED' ? 'text-gray-400' : 'text-blue-600'
              )}>
                {conv.status}
              </span>
            </div>
          </div>

          {/* Hora */}
          <div className="text-sm text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString('es-EC', {
              hour: '2-digit',
              minute: '2-digit',
            }) : '--'}
          </div>
        </Link>
      ))}
    </div>
  );
}
```

---

## 5. Chat en Vivo — Detalle de Conversación

### `src/app/(admin)/admin/inbox/[id]/page.tsx` (Server Component)

```tsx
import { db } from '@/db';
import { conversations, messages } from '@/db/schema/chats';
import { eq, desc } from 'drizzle-orm';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { notFound } from 'next/navigation';

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const conversation = await db.select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);

  if (conversation.length === 0) {
    notFound();
  }

  const msgs = await db.select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(desc(messages.createdAt));

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="border-b pb-4 mb-4">
        <h2 className="text-lg font-semibold">
          {conversation[0].customerName || conversation[0].customerPhone || 'Cliente'}
        </h2>
        <p className="text-sm text-gray-500 capitalize">
          {conversation[0].channel} • {conversation[0].status}
        </p>
      </div>

      {/* Chat Panel (Client Component para interacción en vivo) */}
      <ChatPanel
        conversationId={id}
        channel={conversation[0].channel}
        initialMessages={msgs.reverse()}
      />
    </div>
  );
}
```

### `src/components/chat/ChatPanel.tsx` ('use client')

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Send, Sparkles } from 'lucide-react';

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  createdAt: Date;
  source: string;
}

interface ChatPanelProps {
  conversationId: string;
  channel: string;
  initialMessages: Message[];
}

export function ChatPanel({ conversationId, channel, initialMessages }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al último mensaje
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Polling para nuevos mensajes (cada 3s)
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/chat/messages?conversationId=${conversationId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [conversationId]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    try {
      await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          content: input,
          direction: 'outbound',
          source: channel,
        }),
      });

      setInput('');
      setAiSuggestion('');

      // Refrescar mensajes
      const res = await fetch(`/api/chat/messages?conversationId=${conversationId}`);
      const data = await res.json();
      setMessages(data.messages);
    } finally {
      setIsLoading(false);
    }
  };

  const getAiSuggestion = async () => {
    const lastInbound = [...messages].reverse().find(m => m.direction === 'inbound');
    if (!lastInbound) return;

    const res = await fetch('/api/chat/ai-suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: lastInbound.content }),
    });

    if (res.ok) {
      const data = await res.json();
      setAiSuggestion(data.suggestion);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Messages */}
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex',
                msg.direction === 'outbound' ? 'justify-end' : 'justify-start'
              )}
            >
              <div className={cn(
                'max-w-[70%] rounded-lg px-4 py-2',
                msg.direction === 'outbound'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              )}>
                <p>{msg.content}</p>
                <span className="text-xs opacity-70 mt-1 block">
                  {new Date(msg.createdAt).toLocaleTimeString('es-EC')}
                </span>
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* AI Suggestion */}
      {aiSuggestion && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-purple-900">{aiSuggestion}</p>
            <Button
              variant="ghost"
              size="sm"
              className="text-purple-600 mt-1"
              onClick={() => setInput(aiSuggestion)}
            >
              Usar sugerencia
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 pt-4 border-t">
        <Button
          variant="outline"
          size="icon"
          onClick={getAiSuggestion}
          title="Sugerencia IA"
        >
          <Sparkles className="w-4 h-4" />
        </Button>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Escribe un mensaje..."
          className="flex-1"
        />
        <Button onClick={sendMessage} disabled={isLoading}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
```

---

## 6. Dashboard Overview (`/admin/dashboard`)

### KPIs principales

```tsx
import { db } from '@/db';
import { leads, messages, conversations, searchLogs } from '@/db/schema';
import { sql, count, eq, gte } from 'drizzle-orm';
import { StatCard } from '@/components/admin/StatCard';
import { LeadChart } from '@/components/admin/LeadChart';

export default async function DashboardPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalLeads,
    todayLeads,
    openConversations,
    todayMessages,
    totalSearches,
  ] = await Promise.all([
    db.select({ count: count() }).from(leads),
    db.select({ count: count() }).from(leads).where(gte(leads.createdAt, today)),
    db.select({ count: count() }).from(conversations).where(eq(conversations.status, 'OPEN')),
    db.select({ count: count() }).from(messages).where(gte(messages.createdAt, today)),
    db.select({ count: count() }).from(searchLogs),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Leads Totales"
          value={totalLeads[0].count}
          subtitle={`+${todayLeads[0].count} hoy`}
        />
        <StatCard
          title="Conversaciones Abiertas"
          value={openConversations[0].count}
          subtitle="Requieren atención"
          alert={openConversations[0].count > 10}
        />
        <StatCard
          title="Mensajes Hoy"
          value={todayMessages[0].count}
          subtitle="WA + Instagram"
        />
        <StatCard
          title="Búsquedas"
          value={totalSearches[0].count}
          subtitle="Desde el lanzamiento"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeadChart />
        {/* Más gráficos... */}
      </div>
    </div>
  );
}
```

---

## 7. Componentes Reutilizables

### `src/components/admin/StatCard.tsx`

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  alert?: boolean;
}

export function StatCard({ title, value, subtitle, alert }: StatCardProps) {
  return (
    <Card className={cn(alert && 'border-red-300 bg-red-50')}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        <p className={cn('text-sm mt-1', alert ? 'text-red-600' : 'text-gray-500')}>
          {subtitle}
        </p>
      </CardContent>
    </Card>
  );
}
```

### `src/components/admin/AdminSidebar.tsx`

```tsx
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Inbox,
  Package,
  Users,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react';

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/inbox', label: 'Bandeja', icon: Inbox },
  { href: '/admin/products', label: 'Productos', icon: Package },
  { href: '/admin/leads', label: 'Leads', icon: Users },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/settings', label: 'Configuración', icon: Settings },
];

export function AdminSidebar({ user }: { user: { name?: string | null; role?: string } }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold">Allmedic Admin</h1>
        <p className="text-sm text-gray-500 mt-1">{user.name}</p>
        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded mt-1 inline-block">
          {user.role}
        </span>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              pathname === item.href
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t">
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            className="flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md w-full"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
```

---

## 8. Server Actions para Mutaciones

### `src/app/(admin)/admin/products/actions.ts`

```typescript
'use server';

import { db } from '@/db';
import { products } from '@/db/schema/products';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const productSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().optional(),
  priceNormal: z.string().regex(/^\d+(\.\d{1,2})?$/),
  // ... más campos
});

export async function createProduct(formData: FormData) {
  const data = Object.fromEntries(formData);
  const parsed = productSchema.parse(data);

  await db.insert(products).values({
    ...parsed,
    priceNormal: parsed.priceNormal,
  });

  revalidatePath('/admin/products');
}

export async function toggleProductActive(id: string, isActive: boolean) {
  await db.update(products)
    .set({ isActive })
    .where(eq(products.id, id));

  revalidatePath('/admin/products');
}
```

---

## 9. Notas de Implementación

1. **Polling vs SSE vs WebSockets**: En KVM2/EasyPanel, WebSockets nativos no funcionan. Usar:
   - Polling cada 3s para chat (simple, funciona everywhere)
   - SSE para notificaciones push (si el hosting lo soporta)
   - Evitar WebSockets en shared hosting

2. **Optimización de queries**: Las queries del inbox usan `GROUP BY` + `COUNT`. Para miles de conversaciones, considerar paginación o vista materializada.

3. **Auth en Server Components**: Usar `auth()` de Auth.js v5 directamente en `layout.tsx` y `page.tsx`.

4. **Role-based access**: El modelo `User` tiene `role`. Filtrar rutas en `middleware.ts`:
   ```typescript
   // middleware.ts
   export { auth as middleware } from '@/lib/auth';
   
   export const config = {
     matcher: ['/admin/:path*'],
   };
   ```
