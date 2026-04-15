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
import { getCustomerLocationOnce } from '@/services/customerLocation';
import { fuzzyScore } from '@/services/fuzzy';

const SHOP_FRONT_IMAGE = '/storefront.png';

interface StoreSummary {
  id: string;
  name: string;
  description: string | null;
  imageUrl?: string | null;
  products: { id: string; name: string; price: number }[];
}

type GlobalSearchResult = {
  stores: { id: string; name: string; description: string | null; imageUrl: string | null; address: string | null }[];
  items: { id: string; name: string; price: any; storeId: string; storeName: string }[];
};

export default function SearchPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [global, setGlobal] = useState<GlobalSearchResult | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      router.replace('/auth/login');
      return;
    }
    (async () => {
      const loc = await getCustomerLocationOnce();
      return api.get<StoreSummary[]>('/stores', {
        params: loc ? { latitude: loc.latitude, longitude: loc.longitude } : undefined,
      });
    })()
      .then((res) => setStores(res.data))
      .catch(() => setStores([]));
  }, [hasHydrated, token, router]);

  useEffect(() => {
    const q = debouncedSearch.trim();
    if (!q) {
      setGlobal(null);
      return;
    }
    let cancelled = false;
    setGlobalLoading(true);
    api
      .get<GlobalSearchResult>('/search/global', { params: { q, takeStores: 12, takeItems: 20 } })
      .then((r) => {
        if (!cancelled) setGlobal(r.data ?? { stores: [], items: [] });
      })
      .catch(() => {
        if (!cancelled) setGlobal({ stores: [], items: [] });
      })
      .finally(() => {
        if (!cancelled) setGlobalLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const filteredStores = useMemo(() => {
    if (!debouncedSearch.trim()) return stores;
    const q = debouncedSearch.toLowerCase();
    return stores
      .map((s) => ({
        s,
        score:
          fuzzyScore(s.name, q) ??
          (s.description ? fuzzyScore(s.description, q) : null),
      }))
      .filter((x) => x.score != null)
      .sort((a, b) => (a.score as number) - (b.score as number))
      .map((x) => x.s);
  }, [stores, debouncedSearch]);

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Search" backHref="/dashboard" />
      <ContentPanel>
      <main className="app-shell-narrow py-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search stores..."
          className="w-full px-4 py-3 rounded-button border border-slate-300 focus:ring-2 focus:ring-primary outline-none mb-4"
          autoFocus
        />
        {debouncedSearch.trim() && (
          <Card className="p-4 mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Global results</p>
            {globalLoading ? (
              <p className="text-sm text-slate-500">Searching…</p>
            ) : global ? (
              <div className="space-y-3">
                {global.items.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-800 mb-2">Items</p>
                    <div className="space-y-2">
                      {global.items.slice(0, 8).map((it) => (
                        <Link key={it.id} href={`/dashboard/stores/${it.storeId}`}>
                          <div className="flex justify-between gap-2 py-2 border-b border-slate-100 last:border-0">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{it.name}</p>
                              <p className="text-xs text-slate-500 truncate">{it.storeName}</p>
                            </div>
                            <p className="text-sm font-semibold text-accent whitespace-nowrap">
                              Rs {Number(it.price ?? 0).toFixed(0)}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {global.stores.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-800 mb-2">Stores</p>
                    <div className="grid grid-cols-2 gap-3">
                      {global.stores.slice(0, 6).map((s) => (
                        <Link key={s.id} href={`/dashboard/stores/${s.id}`}>
                          <div className="rounded-card border border-slate-200 bg-white p-3">
                            <p className="font-semibold text-slate-800 line-clamp-1">{s.name}</p>
                            <p className="text-xs text-slate-500 line-clamp-1">{s.address ?? ''}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {global.items.length === 0 && global.stores.length === 0 && (
                  <p className="text-sm text-slate-500">No global results found.</p>
                )}
              </div>
            ) : null}
          </Card>
        )}
        <div className="space-y-3">
          {filteredStores.map((store) => {
            const firstProduct = store.products[0];
            return (
              <Link key={store.id} href={`/dashboard/stores/${store.id}`}>
                <Card className="flex gap-4">
                  <div className="w-16 h-16 rounded-button bg-slate-100 relative overflow-hidden shrink-0">
                    <Image src={store.imageUrl ?? SHOP_FRONT_IMAGE} alt={store.name} fill className="object-cover" sizes="64px" unoptimized={!!store.imageUrl} />
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
