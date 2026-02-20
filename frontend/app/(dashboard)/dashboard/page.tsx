'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';

const CATEGORY_CARDS = [
  { id: 'food', label: 'Food', image: 'https://plus.unsplash.com/premium_photo-1661591247553-cf24f24504ac?w=400&auto=format&fit=crop&q=60', href: '/dashboard/category/food', comingSoon: false },
  { id: 'grocery', label: 'Grocery', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&auto=format&fit=crop&q=60', href: '/dashboard/category/grocery', comingSoon: false },
  { id: 'medicine', label: 'Medicine', image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=60', href: '/dashboard/category/medicine', comingSoon: false },
  { id: 'ride', label: 'Book a Ride', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&auto=format&fit=crop&q=60', href: '#', comingSoon: true },
  { id: 'parcel', label: 'Send Parcel', image: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=400&auto=format&fit=crop&q=60', href: '#', comingSoon: true },
  { id: 'wallet', label: 'Crypto Wallet', image: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400&auto=format&fit=crop&q=60', href: '/wallet', comingSoon: false },
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
        title="Vybe"
        rightAction={
          <Link href="/dashboard/search" className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Search">
            <Search className="w-6 h-6" strokeWidth={2} />
          </Link>
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
            {CATEGORY_CARDS.map((cat) => (
              <div key={cat.id} className="relative">
                {cat.comingSoon ? (
                  <div className="relative pointer-events-none select-none">
                    <Card className="overflow-hidden p-0 opacity-60">
                      <div className="aspect-[4/3] relative">
                        <Image src={cat.image} alt={cat.label} fill className="object-cover" sizes="50vw" />
                      </div>
                      <div className="p-3">
                        <span className="font-medium text-slate-700">{cat.label}</span>
                      </div>
                    </Card>
                    <div className="absolute top-2 right-2 bg-slate-500 text-white text-xs px-2 py-0.5 rounded-full font-medium z-10">
                      Coming Soon
                    </div>
                  </div>
                ) : (
                  <Link href={cat.href}>
                    <Card className="overflow-hidden p-0 hover:shadow-soft-lg transition-shadow">
                      <div className="aspect-[4/3] relative">
                        <Image src={cat.image} alt={cat.label} fill className="object-cover" sizes="50vw" />
                      </div>
                      <div className="p-3">
                        <span className="font-medium text-slate-800">{cat.label}</span>
                      </div>
                    </Card>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
      </ContentPanel>
    </div>
  );
}
