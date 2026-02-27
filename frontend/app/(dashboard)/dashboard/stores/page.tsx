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

const SHOP_PLACEHOLDER =
  'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0';

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
  const [stores, setStores] = useState<StoreSummary[]>([]);

  useEffect(() => {
    if (!token) {
      router.replace('/auth/login');
      return;
    }
    api.get<StoreSummary[]>('/stores').then((res) => setStores(res.data)).catch(() => setStores([]));
  }, [token, router]);

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Stores" backHref="/dashboard" />
      <ContentPanel>
      <main className="max-w-lg mx-auto px-4 py-4">
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
        {stores.length === 0 && (
          <Card className="py-12 text-center">
            <p className="text-slate-500">No stores available</p>
          </Card>
        )}
      </main>
      </ContentPanel>
    </div>
  );
}
