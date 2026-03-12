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

interface WithdrawRequest {
  id: string;
  userId: string;
  role: string;
  amount: number;
  status: string;
  note?: string;
  createdAt: string;
  processedAt?: string | null;
  user: {
    id: string;
    name: string;
    email?: string | null;
    phone: string;
    role: string;
  };
}

export default function AdminFinancePage() {
  const [finance, setFinance] = useState<Finance | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdraws, setWithdraws] = useState<WithdrawRequest[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<Finance>('/admin/finance').then((r) => r.data),
      api.get<WithdrawRequest[]>('/withdraw/requests').then((r) => r.data ?? []),
    ])
      .then(([fin, wd]) => {
        setFinance(fin);
        setWithdraws(wd);
      })
      .catch(() => {
        setFinance(null);
        setWithdraws([]);
      })
      .finally(() => setLoading(false));
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

      <div className="grid md:grid-cols-2 gap-6 mb-8">
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

      <div>
        <h2 className="text-xl font-semibold text-slate-800 mb-3">Withdraw requests</h2>
        <Card className="p-0 overflow-hidden">
          {withdraws.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No withdraw requests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3 font-medium">User</th>
                    <th className="text-left p-3 font-medium">Role</th>
                    <th className="text-right p-3 font-medium">Amount</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Requested</th>
                    <th className="text-left p-3 font-medium">Note</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {withdraws.map((w) => (
                    <tr key={w.id} className="border-t border-slate-100">
                      <td className="p-3">
                        <div className="font-medium">{w.user?.name ?? '—'}</div>
                        <div className="text-xs text-slate-500">{w.user?.phone}</div>
                      </td>
                      <td className="p-3">{w.role}</td>
                      <td className="p-3 text-right font-semibold">Rs {Number(w.amount).toLocaleString()}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          w.status === 'PAID'
                            ? 'bg-green-100 text-green-800'
                            : w.status === 'REJECTED'
                            ? 'bg-red-100 text-red-800'
                            : w.status === 'APPROVED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {w.status}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-slate-500">
                        {new Date(w.createdAt).toLocaleString('en-GB', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="p-3 text-xs text-slate-500 max-w-xs truncate">
                        {w.note ?? '—'}
                      </td>
                      <td className="p-3 space-x-2 text-right">
                        {w.status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                const note = prompt('Optional note for approval', w.note ?? '');
                                try {
                                  const { data } = await api.patch<WithdrawRequest>(
                                    `/withdraw/requests/${w.id}`,
                                    { status: 'APPROVED', note: note ?? undefined },
                                  );
                                  setWithdraws((list) => list.map((it) => (it.id === w.id ? data : it)));
                                } catch (e) {
                                  alert(
                                    (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                                      'Failed to approve',
                                  );
                                }
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                const note = prompt('Reason for rejection', w.note ?? '');
                                try {
                                  const { data } = await api.patch<WithdrawRequest>(
                                    `/withdraw/requests/${w.id}`,
                                    { status: 'REJECTED', note: note ?? undefined },
                                  );
                                  setWithdraws((list) => list.map((it) => (it.id === w.id ? data : it)));
                                } catch (e) {
                                  alert(
                                    (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                                      'Failed to reject',
                                  );
                                }
                              }}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {w.status === 'APPROVED' && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={async () => {
                              const note = prompt('Optional note for marking as paid', w.note ?? '');
                              try {
                                const { data } = await api.patch<WithdrawRequest>(
                                  `/withdraw/requests/${w.id}`,
                                  { status: 'PAID', note: note ?? undefined },
                                );
                                setWithdraws((list) => list.map((it) => (it.id === w.id ? data : it)));
                              } catch (e) {
                                alert(
                                  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                                    'Failed to mark as paid',
                                );
                              }
                            }}
                          >
                            Mark Paid
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
