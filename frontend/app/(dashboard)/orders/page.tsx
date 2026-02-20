'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Package } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { StickyHeader } from '@/components/layout/StickyHeader';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Card } from '@/components/ui/Card';
import api from '@/services/api';

const filters = ['All Order', 'Pending', 'Processing'];

interface OrderItem {
  product: { name: string };
  quantity: number;
  price: number;
}
interface Order {
  id: string;
  orderStatus: string;
  createdAt: string;
  totalAmount: number;
  store?: { name: string };
  items: OrderItem[];
}

export default function OrdersPage() {
  const token = useAuthStore((s) => s.token);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api.get<Order[]>('/orders').then((res) => setOrders(res.data)).catch(() => setOrders([])).finally(() => setLoading(false));
  }, [token]);

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader title="Daily Grocery Food" rightAction={<Search className="w-5 h-5" strokeWidth={2} />} />
      <ContentPanel bottomPadding="sm">
      <main className="max-w-lg mx-auto px-4 py-4">
        <div className="flex gap-2 mb-4">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              className={`shrink-0 px-4 py-2 rounded-pill text-sm font-medium ${
                f === 'All Order' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <Card><p className="text-slate-500 text-center py-4">No orders yet.</p></Card>
            ) : (
              orders.map((o) => (
                <Link key={o.id} href={`/order/${o.id}`}>
                  <Card className="flex gap-4">
                    <div className="w-20 h-20 rounded-button bg-slate-100 flex items-center justify-center shrink-0">
                      <Package className="w-10 h-10 text-primary" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800">{o.store?.name ?? 'Order'}</p>
                      <p className="text-sm text-slate-500">{formatDate(o.createdAt)}</p>
                      <p className="text-accent font-semibold text-sm">Rs {Number(o.totalAmount).toFixed(0)}</p>
                      <span className={`inline-block mt-2 px-3 py-1 rounded-pill text-xs font-medium ${o.orderStatus === 'DELIVERED' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600'}`}>
                        {o.orderStatus}
                      </span>
                    </div>
                  </Card>
                </Link>
              ))
            )}
          </div>
        )}
      </main>
      </ContentPanel>
    </div>
  );
}
