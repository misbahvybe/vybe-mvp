'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
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

function StoreCardSkeleton() {
  return (
    <Card className="overflow-hidden animate-pulse">
      <div className="aspect-square bg-slate-200 rounded-t-card" />
      <div className="pt-3 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-200 rounded w-1/2" />
      </div>
    </Card>
  );
}

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const type = (params?.type as string) || 'grocery';
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    const params = ['food', 'grocery', 'medicine'].includes(type) ? { category: type } : {};
    api.get<StoreSummary[]>('/stores', { params }).then((res) => setStores(res.data)).catch(() => setStores([])).finally(() => setLoading(false));
  }, [token, router, type]);

  const filteredStores = useMemo(() => {
    if (!debouncedSearch.trim()) return stores;
    const q = debouncedSearch.toLowerCase();
    return stores.filter((s) => s.name.toLowerCase().includes(q) || (s.description?.toLowerCase().includes(q)));
  }, [stores, debouncedSearch]);

  const title = type.charAt(0).toUpperCase() + type.slice(1).replace(/-/g, ' ');

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title={title} backHref="/dashboard" />
      <ContentPanel>
      <main className="max-w-lg mx-auto px-4 py-4">
        <div className="sticky top-0 z-10 bg-surface pb-3 -mt-1 pt-1">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stores..."
            className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          />
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-4 mt-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <StoreCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredStores.length === 0 ? (
          <Card className="py-16 text-center mt-4">
            <p className="text-slate-500 text-lg mb-2">No stores found</p>
            <p className="text-slate-400 text-sm">
              {search ? 'Try a different search term' : 'Check back later for new stores'}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4 mt-4">
            {filteredStores.map((store) => {
              const firstProduct = store.products[0];
              return (
                <Link key={store.id} href={`/dashboard/stores/${store.id}`}>
                  <Card className="overflow-hidden hover:shadow-soft-lg transition-shadow">
                    <div className="aspect-square bg-slate-100 rounded-t-card relative overflow-hidden">
                      <Image src={SHOP_FRONT_IMAGE} alt={store.name} fill className="object-cover" sizes="50vw" />
                    </div>
                    <div className="pt-3">
                      <p className="font-semibold text-slate-800">{store.name}</p>
                      <p className="text-accent font-semibold text-sm mt-1">
                        {firstProduct ? `From Rs ${Number(firstProduct.price).toFixed(0)}` : '—'}
                      </p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      </ContentPanel>
    </div>
  );
}
