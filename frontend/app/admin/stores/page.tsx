'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { ChevronRight } from 'lucide-react';
import api from '@/services/api';

interface StoreRow {
  id: string;
  name: string;
  isOpen: boolean;
  status?: 'INVITED' | 'ACTIVE' | 'INACTIVE';
  openingTime?: string;
  closingTime?: string;
  ordersToday: number;
  revenueToday: number;
  isApproved: boolean;
}

export default function AdminStoresPage() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'INVITED' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const fetchStores = () => {
    setLoading(true);
    api
      .get<StoreRow[]>('/admin/stores')
      .then((r) => setStores(r.data ?? []))
      .catch(() => setStores([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const setStoreStatus = async (storeId: string, status: 'INVITED' | 'ACTIVE' | 'INACTIVE') => {
    setSavingId(storeId);
    try {
      await api.patch(`/admin/stores/${storeId}/status`, { status });
      setStores((prev) => prev.map((s) => (s.id === storeId ? { ...s, status } : s)));
    } finally {
      setSavingId(null);
    }
  };

  const statusPill = (status?: StoreRow['status']) => {
    const s = status ?? 'ACTIVE';
    const cls =
      s === 'ACTIVE'
        ? 'bg-green-50 text-green-700 ring-green-200'
        : s === 'INVITED'
          ? 'bg-amber-50 text-amber-800 ring-amber-200'
          : 'bg-slate-100 text-slate-700 ring-slate-200';
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ${cls}`}>
        {s}
      </span>
    );
  };

  const normalized = (s: StoreRow['status']): 'INVITED' | 'ACTIVE' | 'INACTIVE' => s ?? 'ACTIVE';
  const filteredStores =
    filter === 'ALL' ? stores : stores.filter((s) => normalized(s.status) === filter);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Stores</h1>
        <div className="flex flex-wrap items-center gap-2">
          {(['ALL', 'INVITED', 'ACTIVE', 'INACTIVE'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={[
                'text-xs font-semibold px-3 py-1.5 rounded-full ring-1',
                filter === k
                  ? 'bg-primary text-white ring-primary'
                  : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50',
              ].join(' ')}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
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
                  <th className="text-left p-3 font-medium">Onboarding</th>
                  <th className="text-left p-3 font-medium">Open</th>
                  <th className="text-left p-3 font-medium">Hours</th>
                  <th className="text-right p-3 font-medium">Orders Today</th>
                  <th className="text-right p-3 font-medium">Revenue Today</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                  <th className="text-right p-3 font-medium">Menu</th>
                </tr>
              </thead>
              <tbody>
                {filteredStores.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3">
                      {statusPill(s.status)}
                    </td>
                    <td className="p-3">
                      <span className={s.isOpen ? 'text-green-600' : 'text-red-600'}>
                        {s.isOpen ? 'Open' : 'Closed'}
                      </span>
                    </td>
                    <td className="p-3">{s.openingTime && s.closingTime ? `${s.openingTime}–${s.closingTime}` : '—'}</td>
                    <td className="p-3 text-right">{s.ordersToday}</td>
                    <td className="p-3 text-right">Rs {s.revenueToday.toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          className="text-xs font-semibold px-2 py-1 rounded-md bg-white ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
                          disabled={savingId === s.id || s.status === 'ACTIVE'}
                          onClick={() => setStoreStatus(s.id, 'ACTIVE')}
                        >
                          Activate
                        </button>
                        <button
                          className="text-xs font-semibold px-2 py-1 rounded-md bg-white ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
                          disabled={savingId === s.id || s.status === 'INACTIVE'}
                          onClick={() => setStoreStatus(s.id, 'INACTIVE')}
                        >
                          Deactivate
                        </button>
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/admin/stores/${s.id}/menu`}
                        className="text-primary text-sm font-medium inline-flex items-center gap-1"
                      >
                        Menu <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filteredStores.length === 0 && !loading && <p className="p-8 text-center text-slate-500">No stores</p>}
      </Card>
    </div>
  );
}
