'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { Home, ListOrdered, ShoppingCart, Wallet, Menu } from 'lucide-react';

const items: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: '/dashboard', label: 'Home', Icon: Home },
  { href: '/orders', label: 'Order', Icon: ListOrdered },
  { href: '/cart', label: 'My Cart', Icon: ShoppingCart },
  { href: '/wallet', label: 'Wallet', Icon: Wallet },
  { href: '/more', label: 'More', Icon: Menu },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-primary-dark text-white rounded-t-3xl shadow-soft-lg safe-bottom z-50">
      <div className="flex justify-around items-center min-h-[64px] max-w-lg mx-auto pb-[env(safe-area-inset-bottom,0)]">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.Icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-3 min-h-[44px] transition-colors ${
                active ? 'text-accent' : 'text-white/80'
              }`}
            >
              <Icon className="w-6 h-6" aria-hidden />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
