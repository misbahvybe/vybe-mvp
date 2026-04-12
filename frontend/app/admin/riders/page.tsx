'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import api from '@/services/api';

interface RiderRow {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
  isOnline: boolean;
  ordersToday: number;
  totalOrders: number;
  avgDeliveryTimeMins: number;
  acceptanceRate: string;
  totalEarnings: number;
  codCollectedAmount: number;
  codBlocked: boolean;
}

export default function AdminRidersPage() {
  const [riders, setRiders] = useState<RiderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<RiderRow[]>('/admin/riders')
      .then((r) => setRiders(r.data ?? []))
      .catch(() => setRiders([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const settle = async (riderId: string) => {
    if (!confirm('Mark COD as received and reset this rider’s collected balance to 0?')) return;
    setSettlingId(riderId);
    try {
      await api.post(`/admin/riders/${riderId}/settle-cod`);
      load();
    } catch {
      alert('Settlement failed. Try again.');
    } finally {
      setSettlingId(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Captains</h1>
      <p className="text-sm text-slate-600 mb-4">
        Riders carrying COD must deposit cash at the office. When balance reaches the platform limit they
        cannot receive new pickups until you settle here.
      </p>
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Loader size={44} className="mx-auto" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Phone</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">COD held</th>
                  <th className="text-right p-3 font-medium">Orders Today</th>
                  <th className="text-right p-3 font-medium">Total</th>
                  <th className="text-right p-3 font-medium">Avg Delivery</th>
                  <th className="text-right p-3 font-medium">Acceptance</th>
                  <th className="text-right p-3 font-medium">Earnings</th>
                  <th className="text-right p-3 font-medium">Settle</th>
                </tr>
              </thead>
              <tbody>
                {riders.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3">{r.phone}</td>
                    <td className="p-3">
                      <span className={r.isOnline ? 'text-green-600' : 'text-slate-500'}>
                        {r.isOnline ? 'Online' : 'Offline'}
                      </span>
                      {!r.isActive && <span className="ml-1 text-red-600">(Inactive)</span>}
                      {r.codBlocked && (
                        <span className="ml-2 text-amber-700 font-medium">COD block</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-medium">
                      Rs {Number(r.codCollectedAmount ?? 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-right">{r.ordersToday}</td>
                    <td className="p-3 text-right">{r.totalOrders}</td>
                    <td className="p-3 text-right">{r.avgDeliveryTimeMins} min</td>
                    <td className="p-3 text-right">{r.acceptanceRate}%</td>
                    <td className="p-3 text-right">Rs {r.totalEarnings.toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        disabled={settlingId === r.id || Number(r.codCollectedAmount ?? 0) <= 0}
                        onClick={() => settle(r.id)}
                        className="text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-3 py-1.5 rounded-lg"
                      >
                        {settlingId === r.id ? '…' : 'Received'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {riders.length === 0 && !loading && <p className="p-8 text-center text-slate-500">No captains</p>}
      </Card>
    </div>
  );
}
