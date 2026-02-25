'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MdPerson, MdLocationOn, MdCreditCard, MdLock, MdPeople } from 'react-icons/md';
import { useAuthStore } from '@/store/authStore';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const iconClass = 'w-5 h-5 text-primary shrink-0';

const menuItems = [
  { href: '/more/account', label: 'Account Information', Icon: MdPerson },
  { href: '/addresses', label: 'Delivery Address', Icon: MdLocationOn },
  { href: '/profile/payment-methods', label: 'Payment Method', Icon: MdCreditCard },
  { href: '/more/password', label: 'Password', Icon: MdLock },
  { href: '/more/refer', label: 'Reference Friends', Icon: MdPeople },
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
              <item.Icon className={iconClass} />
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
