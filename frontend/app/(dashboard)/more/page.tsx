'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const menuItems = [
  { href: '/more/account', label: 'Account Information', image: '/user-avatar.png' },
  { href: '/addresses', label: 'Delivery Address', image: '/map-location.png' },
  { href: '/profile/payment-methods', label: 'Payment Method', image: '/credit-cards.png' },
  { href: '/more/password', label: 'Password', image: '/secure-padlock.png' },
  { href: '/more/refer', label: 'Reference Friends', image: '/users.png' },
];
export default function MorePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Profile" />
      <ContentPanel bottomPadding="sm">
      <main className="max-w-lg mx-auto px-4 py-4">
        {user && (
          <div className="text-center mb-6">
            <div className="w-20 h-20 rounded-full bg-primary mx-auto flex items-center justify-center text-3xl text-white">
              {user.name.charAt(0)}
            </div>
            <p className="mt-2 font-semibold text-slate-800">{user.name}</p>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
        )}
        <Card padding="none" className="overflow-hidden">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 last:border-0"
            >
              <span className="w-7 h-7 shrink-0 relative block">
                <Image src={item.image} alt={item.label} width={28} height={28} className="object-contain" />
              </span>
              <span className="flex-1 font-medium text-slate-800">{item.label}</span>
              <span className="text-slate-400">›</span>
            </Link>
          ))}
        </Card>
        <div className="mt-8">
          <Button variant="primary" size="lg" fullWidth onClick={handleLogout}>
            Log Out
          </Button>
        </div>
      </main>
      </ContentPanel>
    </div>
  );
}
