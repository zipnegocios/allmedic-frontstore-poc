import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminBottomNav } from '@/components/admin/AdminBottomNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar className="hidden md:flex" />
      <main className="flex-1 bg-[#F5F5F7] overflow-auto pb-20 md:pb-0">
        {children}
      </main>
      <AdminBottomNav />
    </div>
  );
}
