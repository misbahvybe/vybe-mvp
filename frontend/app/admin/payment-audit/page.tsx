'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { Receipt } from 'lucide-react';
import api from '@/services/api';

type AuditItem = {
  id: string;
  adminId: string;
  action: string;
  targetId: string | null;
  createdAt: string;
  admin: { id: string; name: string; email: string | null };
};

type Response = {
  items: AuditItem[];
  total: number;
  limit: number;
  offset: number;
};

const PAGE = 50;

function actionLabel(action: string) {
  if (action === 'MANUAL_PAYMENT_APPROVE') return 'Approved';
  if (action === 'MANUAL_PAYMENT_REJECT') return 'Rejected';
  return action;
}

function actionBadgeClass(action: string) {
  if (action === 'MANUAL_PAYMENT_APPROVE') return 'bg-emerald-100 text-emerald-800';
  if (action === 'MANUAL_PAYMENT_REJECT') return 'bg-rose-100 text-rose-800';
  return 'bg-slate-100 text-slate-700';
}

export default function AdminPaymentAuditPage() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const load = useCallback(async (o: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Response>('/admin/audit-logs/manual-payments', {
        params: { limit: PAGE, offset: o },
      });
      setData(res.data);
      setOffset(o);
    } catch {
      setData(null);
      setError('Could not load audit log.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(0);
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex justify-center py-12">
        <Loader size={44} />
      </div>
    );
  }

  const total = data?.total ?? 0;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + PAGE, total);
  const canPrev = offset > 0;
  const canNext = data != null && offset + PAGE < total;

  return (
    <div>
      <div className="flex items-start gap-3 mb-6">
        <Receipt className="w-8 h-8 text-slate-600 shrink-0 mt-0.5" />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Payment audit</h1>
          <p className="text-slate-600 text-sm mt-1 max-w-2xl">
            Manual online payment reviews (JazzCash / Easypaisa / bank transfer): who approved or rejected, and
            which order. Read-only; entries are written when an admin uses Verify on the order.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-red-600 text-sm mb-4" role="alert">
          {error}
        </p>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600 border-b">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Admin</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Order</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No manual payment verifications yet.
                  </td>
                </tr>
              )}
              {data?.items.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{row.admin.name}</div>
                    {row.admin.email && <div className="text-slate-500 text-xs">{row.admin.email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${actionBadgeClass(row.action)}`}
                    >
                      {actionLabel(row.action)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {row.targetId ? (
                      <Link href={`/order/${row.targetId}`} className="text-primary font-medium hover:underline">
                        Open order
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm text-slate-600">
          <span>
            Showing {pageStart}–{pageEnd} of {total}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canPrev || loading}
              onClick={() => void load(Math.max(0, offset - PAGE))}
            >
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canNext || loading}
              onClick={() => void load(offset + PAGE)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
