'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Bike } from 'lucide-react';
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
}

export default function AdminRidersPage() {
  const [riders, setRiders] = useState<RiderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<RiderRow[]>('/admin/riders').then((r) => setRiders(r.data ?? [])).catch(() => setRiders([])).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Riders</h1>
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
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Phone</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Orders Today</th>
                  <th className="text-right p-3 font-medium">Total</th>
                  <th className="text-right p-3 font-medium">Avg Delivery</th>
                  <th className="text-right p-3 font-medium">Acceptance</th>
                  <th className="text-right p-3 font-medium">Earnings</th>
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
                    </td>
                    <td className="p-3 text-right">{r.ordersToday}</td>
                    <td className="p-3 text-right">{r.totalOrders}</td>
                    <td className="p-3 text-right">{r.avgDeliveryTimeMins} min</td>
                    <td className="p-3 text-right">{r.acceptanceRate}%</td>
                    <td className="p-3 text-right">Rs {r.totalEarnings.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {riders.length === 0 && !loading && <p className="p-8 text-center text-slate-500">No riders</p>}
      </Card>
    </div>
  );
}
