'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Bike, MapPin, Phone, User, Wallet, AlertTriangle, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import api from '@/services/api';

interface RiderDetail {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  isActive: boolean;
  isOnline: boolean;
  ordersToday: number;
  totalOrders: number;
  avgDeliveryTimeMins: number;
  acceptanceRate: string;
  totalEarnings: number;
  codCollectedAmount: number;
  codBlocked: boolean;
  memberSince: string;
  vehicleType: string | null;
  vehicleNumber: string | null;
  isAvailable: boolean;
  currentLatitude: number | null;
  currentLongitude: number | null;
  profileUpdatedAt: string | null;
  codLimitPkr: number;
  remainingCodUntilLimit: number;
}

function mapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export default function AdminRiderDetailPage() {
  const params = useParams();
  const riderId = typeof params?.riderId === 'string' ? params.riderId : null;
  const [data, setData] = useState<RiderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);

  const load = useCallback(() => {
    if (!riderId) return;
    setLoading(true);
    setError(null);
    api
      .get<RiderDetail>(`/admin/riders/${riderId}`)
      .then((r) => setData(r.data ?? null))
      .catch(() => {
        setData(null);
        setError('Rider not found or you do not have access.');
      })
      .finally(() => setLoading(false));
  }, [riderId]);

  useEffect(() => {
    load();
  }, [load]);

  const settle = async () => {
    if (!riderId || !data) return;
    if (!confirm('Mark COD as received and reset this rider’s collected balance to 0?')) return;
    setSettling(true);
    try {
      await api.post(`/admin/riders/${riderId}/settle-cod`);
      load();
    } catch {
      alert('Settlement failed. Try again.');
    } finally {
      setSettling(false);
    }
  };

  if (!riderId) {
    return (
      <div className="text-slate-600">
        <p>Invalid rider.</p>
        <Link href="/admin/riders" className="text-primary font-medium mt-2 inline-block">
          Back to Captains
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader size={48} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <Link
          href="/admin/riders"
          className="inline-flex items-center gap-2 text-sm text-primary font-medium mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Captains
        </Link>
        <Card className="p-8 text-center text-slate-600">{error ?? 'Unable to load rider.'}</Card>
      </div>
    );
  }

  const hasLocation = data.currentLatitude != null && data.currentLongitude != null;

  return (
    <div>
      <Link
        href="/admin/riders"
        className="inline-flex items-center gap-2 text-sm text-primary font-medium mb-4 hover:underline"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Captains
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{data.name}</h1>
          <p className="text-sm text-slate-500 mt-1">Captain · ID {data.id.slice(0, 8)}…</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            disabled={settling || Number(data.codCollectedAmount) <= 0}
            loading={settling}
            onClick={() => void settle()}
          >
            Mark COD received
          </Button>
        </div>
      </div>

      {data.codBlocked && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">COD limit / blocked</p>
            <p className="text-sm mt-1 text-amber-900">
              This rider cannot take new pickups until unsettled cash is cleared. Use “Mark COD received” after
              they deposit at the office.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wide mb-3">
            <User className="w-4 h-4" /> Account
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Phone</dt>
              <dd className="font-medium text-slate-800 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {data.phone}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium text-slate-800 text-right break-all">{data.email ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Member since</dt>
              <dd className="font-medium text-slate-800">
                {new Date(data.memberSince).toLocaleDateString()}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Account status</dt>
              <dd className="font-medium">{data.isActive ? 'Active' : <span className="text-red-600">Inactive</span>}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">App status</dt>
              <dd className="font-medium">{data.isOnline ? 'Online' : 'Offline'}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5 border-amber-100 bg-amber-50/40">
          <div className="flex items-center gap-2 text-amber-900 text-xs font-semibold uppercase tracking-wide mb-3">
            <Wallet className="w-4 h-4" /> Cash on delivery (held)
          </div>
          <p className="text-3xl font-bold text-slate-900">
            Rs {Number(data.codCollectedAmount).toLocaleString()}
          </p>
          <p className="text-sm text-slate-600 mt-2">
            Limit Rs {Number(data.codLimitPkr).toLocaleString()} ·{' '}
            <span className="font-medium">Rs {Number(data.remainingCodUntilLimit).toLocaleString()} remaining</span> before
            block
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wide mb-3">
            <Bike className="w-4 h-4" /> Vehicle
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Type</dt>
              <dd className="font-medium text-slate-800">{data.vehicleType ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Number</dt>
              <dd className="font-medium text-slate-800">{data.vehicleNumber ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Taking orders</dt>
              <dd className="font-medium">{data.isAvailable ? 'Yes (available)' : 'No'}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wide mb-3">
            <MapPin className="w-4 h-4" /> Last known location
          </div>
          {hasLocation ? (
            <>
              <p className="text-sm font-mono text-slate-800">
                {data.currentLatitude?.toFixed(5)}, {data.currentLongitude?.toFixed(5)}
              </p>
              {data.profileUpdatedAt && (
                <p className="text-xs text-slate-500 mt-1">
                  Profile updated {new Date(data.profileUpdatedAt).toLocaleString()}
                </p>
              )}
              <a
                href={mapsLink(data.currentLatitude!, data.currentLongitude!)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary font-medium mt-3"
              >
                Open in Maps <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </>
          ) : (
            <p className="text-sm text-slate-500">No GPS saved yet.</p>
          )}
        </Card>

        <Card className="p-5 md:col-span-2">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-3">Performance</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Orders today</p>
              <p className="text-xl font-bold text-slate-900">{data.ordersToday}</p>
            </div>
            <div>
              <p className="text-slate-500">Total orders</p>
              <p className="text-xl font-bold text-slate-900">{data.totalOrders}</p>
            </div>
            <div>
              <p className="text-slate-500">Avg delivery</p>
              <p className="text-xl font-bold text-slate-900">{data.avgDeliveryTimeMins} min</p>
            </div>
            <div>
              <p className="text-slate-500">Acceptance</p>
              <p className="text-xl font-bold text-slate-900">{data.acceptanceRate}%</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-slate-500">Lifetime earnings</p>
              <p className="text-xl font-bold text-accent">Rs {Number(data.totalEarnings).toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
