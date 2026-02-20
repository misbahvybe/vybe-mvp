'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import api from '@/services/api';
import type { Address } from '@/types';

export default function AddressesPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      router.replace('/auth/login');
      return;
    }
    api
      .get<Address[]>('/users/me/addresses')
      .then((res) => setAddresses(res.data))
      .catch(() => setAddresses([]))
      .finally(() => setLoading(false));
  }, [token, router]);

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Delivery Address" backHref="/more" />
      <ContentPanel bottomPadding="sm">
      <main className="max-w-lg mx-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {addresses.map((addr) => (
              <Card key={addr.id} className="mb-4 flex items-center gap-4">
                <MapPin className="w-6 h-6 text-primary shrink-0" strokeWidth={2} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800">{addr.label || 'Address'}</p>
                  <p className="text-sm text-slate-600">{addr.fullAddress}</p>
                  {addr.isDefault && (
                    <span className="inline-block mt-1 text-xs text-primary font-medium">Default</span>
                  )}
                </div>
              </Card>
            ))}
            <Link href="/addresses/new">
              <Button variant="outline" size="lg" fullWidth>Add new address</Button>
            </Link>
          </>
        )}
      </main>
      </ContentPanel>
    </div>
  );
}
