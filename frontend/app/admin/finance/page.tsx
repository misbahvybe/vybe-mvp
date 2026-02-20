'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Wallet, Download } from 'lucide-react';
import api from '@/services/api';

interface Finance {
  today: {
    grossGmv: number;
    platformCommission: number;
    serviceFeesCollected: number;
    deliveryFeesCollected: number;
    riderCost: number;
    netPlatformRevenue: number;
  };
  month: {
    totalGmv: number;
    totalCommission: number;
    totalServiceFees: number;
    totalDeliveryFees: number;
    cancellationLoss: number;
    cancelledOrders: number;
  };
}

export default function AdminFinancePage() {
  const [finance, setFinance] = useState<Finance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Finance>('/admin/finance').then((r) => setFinance(r.data)).catch(() => setFinance(null)).finally(() => setLoading(false));
  }, []);

  const exportCsv = () => {
    const rows = [
      ['Metric', 'Today', 'This Month'],
      ['Gross GMV', finance?.today.grossGmv ?? 0, finance?.month.totalGmv ?? 0],
      ['Platform Commission (15%)', finance?.today.platformCommission ?? 0, finance?.month.totalCommission ?? 0],
      ['Service Fees', finance?.today.serviceFeesCollected ?? 0, finance?.month.totalServiceFees ?? 0],
      ['Delivery Fees', finance?.today.deliveryFeesCollected ?? 0, finance?.month.totalDeliveryFees ?? 0],
      ['Rider Cost', finance?.today.riderCost ?? 0, '-'],
      ['Net Platform Revenue', finance?.today.netPlatformRevenue ?? 0, '-'],
      ['Cancellations', '-', finance?.month.cancelledOrders ?? 0],
      ['Cancellation Loss', '-', finance?.month.cancellationLoss ?? 0],
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vybe-finance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Finance</h1>
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="w-4 h-4 mr-2 inline" /> Export CSV
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5" /> Today
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-600">Gross GMV</span>
              <span className="font-semibold">Rs {(finance?.today.grossGmv ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Platform Commission (15%)</span>
              <span className="font-semibold">Rs {(finance?.today.platformCommission ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Service Fees</span>
              <span className="font-semibold">Rs {(finance?.today.serviceFeesCollected ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Delivery Fees</span>
              <span className="font-semibold">Rs {(finance?.today.deliveryFeesCollected ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>Rider Cost</span>
              <span className="font-semibold">-Rs {(finance?.today.riderCost ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-3 border-t font-bold text-accent">
              <span>Net Platform Revenue</span>
              <span>Rs {(finance?.today.netPlatformRevenue ?? 0).toLocaleString()}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">This Month</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-600">Total GMV</span>
              <span className="font-semibold">Rs {(finance?.month.totalGmv ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Total Commission</span>
              <span className="font-semibold">Rs {(finance?.month.totalCommission ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Total Service Fees</span>
              <span className="font-semibold">Rs {(finance?.month.totalServiceFees ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Total Delivery Fees</span>
              <span className="font-semibold">Rs {(finance?.month.totalDeliveryFees ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>Cancellations</span>
              <span className="font-semibold">{finance?.month.cancelledOrders ?? 0} orders</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>Cancellation Loss</span>
              <span className="font-semibold">Rs {(finance?.month.cancellationLoss ?? 0).toLocaleString()}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
