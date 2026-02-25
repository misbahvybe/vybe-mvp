'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MdSearch, MdRestaurant, MdShoppingBasket, MdLocalPharmacy, MdTwoWheeler, MdLocalShipping, MdAccountBalanceWallet, MdPerson } from 'react-icons/md';
import { useAuthStore } from '@/store/authStore';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';

const CATEGORY_CARDS = [
  { id: 'food', label: 'Food', icon: MdRestaurant, href: '/dashboard/category/food', comingSoon: false },
  { id: 'grocery', label: 'Grocery', icon: MdShoppingBasket, href: '/dashboard/category/grocery', comingSoon: false },
  { id: 'medicine', label: 'Medicine', icon: MdLocalPharmacy, href: '/dashboard/category/medicine', comingSoon: false },
  { id: 'ride', label: 'Ride', icon: MdTwoWheeler, href: '#', comingSoon: true },
  { id: 'courier', label: 'Courier', icon: MdLocalShipping, href: '#', comingSoon: true },
  { id: 'wallet', label: 'Crypto Wallet', icon: MdAccountBalanceWallet, href: '/wallet', comingSoon: false },
];

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (token === undefined) return;
    if (!token) {
      router.replace('/auth/login');
      return;
    }
  }, [token, router]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const firstName = user.name.split(' ')[0] || user.name;

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader
        title="VYBE"
        rightAction={
          <div className="flex items-center gap-1">
            <Link href="/dashboard/search" className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Search">
              <MdSearch className="w-5 h-5" />
            </Link>
            <Link href="/more/account" className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Profile">
              <MdPerson className="w-5 h-5" />
            </Link>
          </div>
        }
      />
      <ContentPanel>
      <main className="max-w-lg mx-auto px-4 py-4">
        <section className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">Hi, {firstName}</h1>
          <p className="text-slate-600 text-sm mt-1">What would you like to order today?</p>
        </section>

        <section>
          <h2 className="text-sm font-medium text-slate-600 mb-3">Categories</h2>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORY_CARDS.map((cat) => {
              const Icon = cat.icon;
              return (
                <div key={cat.id} className="relative">
                  {cat.comingSoon ? (
                    <div className="relative pointer-events-none select-none">
                      <Card className="p-4 flex items-center gap-3 opacity-60">
                        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                          <Icon className="w-7 h-7 text-slate-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-slate-700">{cat.label}</span>
                        </div>
                        <span className="text-xs bg-slate-400 text-white px-2 py-0.5 rounded-full font-medium shrink-0">
                          Coming Soon
                        </span>
                      </Card>
                    </div>
                  ) : (
                    <Link href={cat.href}>
                      <Card className="p-4 flex items-center gap-3 hover:shadow-soft-lg transition-shadow border border-slate-200">
                        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                          <Icon className="w-7 h-7 text-slate-700" />
                        </div>
                        <span className="font-medium text-slate-800">{cat.label}</span>
                      </Card>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
      </ContentPanel>
    </div>
  );
}
