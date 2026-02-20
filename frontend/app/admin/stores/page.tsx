'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Store, ChevronRight } from 'lucide-react';
import api from '@/services/api';

interface StoreRow {
  id: string;
  name: string;
  isOpen: boolean;
  openingTime?: string;
  closingTime?: string;
  ordersToday: number;
  revenueToday: number;
  isApproved: boolean;
}

export default function AdminStoresPage() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<StoreRow[]>('/admin/stores').then((r) => setStores(r.data ?? [])).catch(() => setStores([])).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Stores</h1>
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3 font-medium">Store</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Hours</th>
                  <th className="text-right p-3 font-medium">Orders Today</th>
                  <th className="text-right p-3 font-medium">Revenue Today</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3">
                      <span className={s.isOpen ? 'text-green-600' : 'text-red-600'}>
                        {s.isOpen ? 'Open' : 'Closed'}
                      </span>
                    </td>
                    <td className="p-3">{s.openingTime && s.closingTime ? `${s.openingTime}–${s.closingTime}` : '—'}</td>
                    <td className="p-3 text-right">{s.ordersToday}</td>
                    <td className="p-3 text-right">Rs {s.revenueToday.toLocaleString()}</td>
                    <td className="p-3">
                      <span className="text-slate-400 text-sm">—</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {stores.length === 0 && !loading && <p className="p-8 text-center text-slate-500">No stores</p>}
      </Card>
    </div>
  );
}
