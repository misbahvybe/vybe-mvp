'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import {
  LayoutDashboard,
  Package,
  Store,
  Bike,
  Users,
  UserPlus,
  Wallet,
  BarChart3,
  Settings,
  Menu,
  X,
} from 'lucide-react';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Orders', icon: Package },
  { href: '/admin/stores', label: 'Stores', icon: Store },
  { href: '/admin/riders', label: 'Riders', icon: Bike },
  { href: '/admin/partners', label: 'Partners', icon: UserPlus },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/finance', label: 'Finance', icon: Wallet },
  { href: '/admin/metrics', label: 'Metrics', icon: BarChart3 },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      if (pathname?.startsWith('/admin')) router.replace('/auth/login');
      return;
    }
    if (user && user.role !== 'ADMIN') {
      router.replace('/');
      return;
    }
  }, [hasHydrated, token, pathname, router, user]);

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-primary-dark text-white transform transition-transform md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-white/10">
          <span className="font-bold text-lg">VYBE Admin</span>
          <button type="button" onClick={() => setSidebarOpen(false)} className="md:hidden p-2">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="p-2 space-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href))
                  ? 'bg-primary text-white'
                  : 'hover:bg-white/10'
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <button
            type="button"
            onClick={() => { logout(); router.replace('/auth/login'); }}
            className="w-full py-2 text-sm text-white/80 hover:text-white"
          >
            Logout
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col md:ml-64">
        <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 flex items-center px-4">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 -ml-2"
          >
            <Menu className="w-6 h-6" />
          </button>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}
    </div>
  );
}
