'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import api from '@/services/api';

const SHOP_PLACEHOLDER = '/storefront.png';

interface StoreSummary {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  address?: string | null;
  products: { id: string; name: string; price: number }[];
}

export default function StoresPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      router.replace('/auth/login');
      return;
    }
    setLoading(true);
    setError(null);
    api
      .get<StoreSummary[]>('/stores')
      .then((res) => setStores(res.data))
      .catch((e: unknown) => {
        setStores([]);
        const status = (e as { response?: { status?: number } })?.response?.status;
        const base = api.defaults.baseURL;
        if (status === 401) {
          setError('Unauthorized (401). Your login token is missing/expired. Please login again.');
          return;
        }
        // Common production misconfig: NEXT_PUBLIC_API_URL not set (defaults to localhost)
        if (typeof window !== 'undefined' && base?.includes('localhost') && window.location.hostname !== 'localhost') {
          setError(
            `API URL misconfigured. Your frontend is calling "${base}". Set NEXT_PUBLIC_API_URL on Vercel to your Railway backend URL ending with /api/v1.`,
          );
          return;
        }
        setError('Failed to load stores. Check API URL and backend logs.');
      })
      .finally(() => setLoading(false));
  }, [hasHydrated, token, router]);

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Stores" backHref="/dashboard" />
      <ContentPanel>
      <main className="app-shell-narrow py-4">
        {loading && (
          <Card className="py-10 text-center">
            <p className="text-slate-500">Loading stores…</p>
          </Card>
        )}
        {!loading && error && (
          <Card className="py-6 px-4">
            <p className="text-slate-800 font-medium mb-1">Couldn&apos;t load stores</p>
            <p className="text-slate-600 text-sm break-words">{error}</p>
          </Card>
        )}
        <div className="grid grid-cols-2 gap-4">
          {stores.map((store) => {
            const firstProduct = store.products[0];
            return (
              <Link key={store.id} href={`/dashboard/stores/${store.id}`}>
                <Card className="overflow-hidden hover:shadow-soft-lg transition-shadow">
                  <div className="aspect-square bg-slate-100 rounded-t-card relative overflow-hidden">
                    <Image
                      src={store.imageUrl || SHOP_PLACEHOLDER}
                      alt={store.name}
                      fill
                      className="object-cover"
                      sizes="50vw"
                      unoptimized={!!store.imageUrl}
                    />
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
        {!loading && !error && stores.length === 0 && (
          <Card className="py-12 text-center">
            <p className="text-slate-500">No stores available</p>
          </Card>
        )}
      </main>
      </ContentPanel>
    </div>
  );
}
