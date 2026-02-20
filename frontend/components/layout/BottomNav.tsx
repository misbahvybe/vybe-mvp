'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, ShoppingCart, Wallet, MoreHorizontal } from 'lucide-react';

const items = [
  { href: '/dashboard', label: 'Home', Icon: Home },
  { href: '/orders', label: 'Order', Icon: ClipboardList },
  { href: '/cart', label: 'My Cart', Icon: ShoppingCart },
  { href: '/wallet', label: 'Wallet', Icon: Wallet },
  { href: '/more', label: 'More', Icon: MoreHorizontal },
];

const iconClass = 'w-6 h-6';

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-primary-dark text-white rounded-t-3xl shadow-soft-lg safe-bottom z-50">
      <div className="flex justify-around items-center min-h-[64px] max-w-lg mx-auto pb-[env(safe-area-inset-bottom,0)]">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-3 min-h-[44px] transition-colors ${
                active ? 'text-accent' : 'text-white/80'
              }`}
            >
              <Icon className={iconClass} strokeWidth={2} aria-hidden />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
