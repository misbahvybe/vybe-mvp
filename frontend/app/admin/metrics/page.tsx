'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { BarChart3 } from 'lucide-react';
import api from '@/services/api';

interface ChartPoint {
  date: string;
  orders: number;
  revenue: number;
}

export default function AdminMetricsPage() {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ChartPoint[]>('/admin/metrics/charts').then((r) => setData(r.data ?? [])).catch(() => setData([])).finally(() => setLoading(false));
  }, []);

  const maxOrders = Math.max(...data.map((d) => d.orders), 1);
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Metrics (Last 30 Days)</h1>
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" /> Orders per Day
          </h2>
          <div className="space-y-1 h-64 overflow-y-auto">
            {data.map((d) => (
              <div key={d.date} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-20 shrink-0">{d.date.slice(5)}</span>
                <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-primary rounded"
                    style={{ width: `${(d.orders / maxOrders) * 100}%`, minWidth: d.orders > 0 ? '4px' : 0 }}
                  />
                </div>
                <span className="text-sm font-medium w-8 text-right">{d.orders}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Revenue per Day</h2>
          <div className="space-y-1 h-64 overflow-y-auto">
            {data.map((d) => (
              <div key={d.date} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-20 shrink-0">{d.date.slice(5)}</span>
                <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-accent rounded"
                    style={{ width: `${(d.revenue / maxRevenue) * 100}%`, minWidth: d.revenue > 0 ? '4px' : 0 }}
                  />
                </div>
                <span className="text-sm font-medium w-16 text-right">Rs {d.revenue}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
