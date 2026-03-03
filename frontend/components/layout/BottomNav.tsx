'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/dashboard', label: 'Home', image: '/simple-house.png' },
  { href: '/orders', label: 'Order', image: '/checklist.png' },
  { href: '/cart', label: 'My Cart', image: '/shopping-cart.png' },
  { href: '/wallet', label: 'Wallet', image: '/wallet.png' },
  { href: '/more', label: 'More', image: '/Menu.png' },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-primary-dark text-white rounded-t-3xl shadow-soft-lg safe-bottom z-50">
      <div className="flex justify-around items-center min-h-[64px] max-w-lg mx-auto pb-[env(safe-area-inset-bottom,0)]">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-3 min-h-[44px] transition-colors ${
                active ? 'text-accent' : 'text-white/80'
              }`}
            >
              <span className="w-8 h-8 relative block">
                <Image
                  src={item.image}
                  alt={item.label}
                  width={32}
                  height={32}
                  className="object-contain"
                  aria-hidden
                />
              </span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
