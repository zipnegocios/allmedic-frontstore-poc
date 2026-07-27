import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminBottomNav } from '@/components/admin/AdminBottomNav';
import { UnanchoredTasksPanel } from '@/components/admin/UnanchoredTasksPanel';
import { AnchoredTaskProvider } from '@/contexts/AnchoredTaskContext';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AnchoredTaskProvider>
      <div className="flex min-h-screen">
        <AdminSidebar className="hidden md:flex" />
        <main className="flex-1 bg-[#F5F5F7] overflow-auto pb-[calc(5rem_+_env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
        <AdminBottomNav />
        <UnanchoredTasksPanel />
      </div>
    </AnchoredTaskProvider>
  );
}
