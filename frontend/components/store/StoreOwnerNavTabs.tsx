'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { LayoutGrid, Monitor, Settings, ShoppingBag, Wallet } from 'lucide-react';

type Tab = 'orders' | 'products' | 'earnings' | 'settings';

function normalizeTab(v: string | null): Tab {
  if (v === 'products' || v === 'earnings' || v === 'settings') return v;
  return 'orders';
}

export function StoreOwnerNavTabs(props?: { wide?: boolean }) {
  const pathname = usePathname();
  const sp = useSearchParams();

  const isPos = (pathname ?? '').startsWith('/store/pos');
  const activeTab = normalizeTab(sp?.get('tab'));

  const items: { key: string; label: string; href: string; active: boolean; icon: React.ReactNode }[] = [
    {
      key: 'orders',
      label: 'Orders',
      href: '/store/dashboard?tab=orders',
      active: !isPos && activeTab === 'orders',
      icon: <LayoutGrid className="w-4 h-4" />,
    },
    {
      key: 'products',
      label: 'Products',
      href: '/store/dashboard?tab=products',
      active: !isPos && activeTab === 'products',
      icon: <ShoppingBag className="w-4 h-4" />,
    },
    {
      key: 'earnings',
      label: 'Earnings',
      href: '/store/dashboard?tab=earnings',
      active: !isPos && activeTab === 'earnings',
      icon: <Wallet className="w-4 h-4" />,
    },
    {
      key: 'settings',
      label: 'Settings',
      href: '/store/dashboard?tab=settings',
      active: !isPos && activeTab === 'settings',
      icon: <Settings className="w-4 h-4" />,
    },
    {
      key: 'pos',
      label: 'POS',
      href: '/store/pos',
      active: isPos,
      icon: <Monitor className="w-4 h-4" />,
    },
  ];

  return (
    <div className="border-t border-slate-200 bg-surface">
      <div className={(props?.wide ? 'app-shell-wide' : 'px-2') + ' flex overflow-x-auto'}>
        {items.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={`flex-1 min-w-[4rem] flex items-center justify-center gap-1.5 py-3 px-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              t.active ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon}
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

