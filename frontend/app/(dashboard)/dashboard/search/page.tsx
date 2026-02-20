'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import api from '@/services/api';

const SHOP_FRONT_IMAGE =
  'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0';

interface StoreSummary {
  id: string;
  name: string;
  description: string | null;
  products: { id: string; name: string; price: number }[];
}

export default function SearchPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!token) {
      router.replace('/auth/login');
      return;
    }
    api.get<StoreSummary[]>('/stores').then((res) => setStores(res.data)).catch(() => setStores([]));
  }, [token, router]);

  const filteredStores = useMemo(() => {
    if (!debouncedSearch.trim()) return stores;
    const q = debouncedSearch.toLowerCase();
    return stores.filter((s) => s.name.toLowerCase().includes(q) || (s.description?.toLowerCase().includes(q)));
  }, [stores, debouncedSearch]);

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Search" backHref="/dashboard" />
      <ContentPanel>
      <main className="max-w-lg mx-auto px-4 py-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search stores..."
          className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary outline-none mb-4"
          autoFocus
        />
        <div className="space-y-3">
          {filteredStores.map((store) => {
            const firstProduct = store.products[0];
            return (
              <Link key={store.id} href={`/dashboard/stores/${store.id}`}>
                <Card className="flex gap-4">
                  <div className="w-16 h-16 rounded-button bg-slate-100 relative overflow-hidden shrink-0">
                    <Image src={SHOP_FRONT_IMAGE} alt={store.name} fill className="object-cover" sizes="64px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800">{store.name}</p>
                    <p className="text-accent font-semibold text-sm">
                      {firstProduct ? `From Rs ${Number(firstProduct.price).toFixed(0)}` : '—'}
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
        {filteredStores.length === 0 && (
          <Card className="py-12 text-center">
            <p className="text-slate-500">{search ? 'No stores match your search' : 'Start typing to search'}</p>
          </Card>
        )}
      </main>
      </ContentPanel>
    </div>
  );
}
