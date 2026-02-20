'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import {
  Package,
  TrendingUp,
  Bike,
  Store,
  Clock,
  AlertTriangle,
  DollarSign,
  ChevronRight,
} from 'lucide-react';
import api from '@/services/api';

const POLL_MS = 20000;

interface Metrics {
  totalOrders: number;
  ordersToday: number;
  revenueToday: number;
  totalRevenue: number;
  activeRiders: number;
  activeStores: number;
  avgDeliveryTimeMins: number;
  cancellationRate: string;
  orderCountsByStatus: { pending: number; preparing: number; readyForPickup: number; outForDelivery: number; cancelledToday: number };
  contributionMargin: { avgOrderValue: number; commission: number; serviceFee: number; riderCost: number; net: number };
}

interface Alerts {
  ordersPendingStuck: { id: string; storeName?: string }[];
  ordersReadyStuck: string[];
  storesClosedDuringHours: { id: string; name: string }[];
  ridersInactiveOver2Hours: { id: string; name?: string }[];
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    Promise.all([
      api.get<Metrics>('/admin/metrics').then((r) => r.data),
      api.get<Alerts>('/admin/alerts').then((r) => r.data),
    ])
      .then(([m, a]) => {
        setMetrics(m ?? null);
        setAlerts(a ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, POLL_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const counts = metrics?.orderCountsByStatus ?? { pending: 0, preparing: 0, readyForPickup: 0, outForDelivery: 0, cancelledToday: 0 };
  const alertCount = (alerts?.ordersPendingStuck?.length ?? 0) + (alerts?.ordersReadyStuck?.length ?? 0) +
    (alerts?.storesClosedDuringHours?.length ?? 0) + (alerts?.ridersInactiveOver2Hours?.length ?? 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase">Orders Today</p>
          <p className="text-2xl font-bold text-primary">{metrics?.ordersToday ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase">Total Orders</p>
          <p className="text-2xl font-bold text-slate-800">{metrics?.totalOrders ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase">Revenue Today</p>
          <p className="text-2xl font-bold text-accent">Rs {(metrics?.revenueToday ?? 0).toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase">Total Revenue</p>
          <p className="text-2xl font-bold text-slate-800">Rs {(metrics?.totalRevenue ?? 0).toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase">Active Riders</p>
          <p className="text-2xl font-bold text-slate-800">{metrics?.activeRiders ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase">Active Stores</p>
          <p className="text-2xl font-bold text-slate-800">{metrics?.activeStores ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase">Avg Delivery</p>
          <p className="text-2xl font-bold text-slate-800">{metrics?.avgDeliveryTimeMins ?? 0} min</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase">Cancellation Rate</p>
          <p className="text-2xl font-bold text-slate-800">{metrics?.cancellationRate ?? 0}%</p>
        </Card>
      </div>

      {/* Contribution Margin */}
      {metrics?.contributionMargin && (
        <Card className="p-4 mb-6 border-l-4 border-primary">
          <h2 className="font-semibold text-slate-800 mb-3">Contribution Margin per Order</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
            <div>
              <p className="text-slate-500">Avg Order</p>
              <p className="font-semibold">Rs {metrics.contributionMargin.avgOrderValue.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-slate-500">Commission (15%)</p>
              <p className="font-semibold">Rs {metrics.contributionMargin.commission.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-slate-500">Service Fee</p>
              <p className="font-semibold">Rs {metrics.contributionMargin.serviceFee}</p>
            </div>
            <div>
              <p className="text-slate-500">Rider Cost</p>
              <p className="font-semibold text-red-600">-Rs {metrics.contributionMargin.riderCost.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-slate-500">Net</p>
              <p className="font-bold text-accent">Rs {metrics.contributionMargin.net.toFixed(0)}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Live Orders */}
      <h2 className="text-lg font-semibold text-slate-800 mb-3">Live Operations</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Link href="/admin/orders?status=PENDING">
          <Card className="p-4 border-l-4 border-amber-400 hover:shadow-md transition-shadow">
            <p className="text-xs text-slate-500 uppercase">Pending</p>
            <p className="text-2xl font-bold text-amber-700">{counts.pending}</p>
          </Card>
        </Link>
        <Link href="/admin/orders?status=STORE_ACCEPTED">
          <Card className="p-4 border-l-4 border-blue-400 hover:shadow-md transition-shadow">
            <p className="text-xs text-slate-500 uppercase">Preparing</p>
            <p className="text-2xl font-bold text-blue-700">{counts.preparing}</p>
          </Card>
        </Link>
        <Link href="/admin/orders?status=READY_FOR_PICKUP">
          <Card className="p-4 border-l-4 border-purple-400 hover:shadow-md transition-shadow">
            <p className="text-xs text-slate-500 uppercase">Ready</p>
            <p className="text-2xl font-bold text-purple-700">{counts.readyForPickup}</p>
          </Card>
        </Link>
        <Link href="/admin/orders?status=out_for_delivery">
          <Card className="p-4 border-l-4 border-green-400 hover:shadow-md transition-shadow">
            <p className="text-xs text-slate-500 uppercase">Out for Delivery</p>
            <p className="text-2xl font-bold text-green-700">{counts.outForDelivery}</p>
          </Card>
        </Link>
        <Link href="/admin/orders?status=CANCELLED">
          <Card className="p-4 border-l-4 border-red-400 hover:shadow-md transition-shadow">
            <p className="text-xs text-slate-500 uppercase">Cancelled Today</p>
            <p className="text-2xl font-bold text-red-700">{counts.cancelledToday}</p>
          </Card>
        </Link>
      </div>

      {/* Alerts */}
      {alertCount > 0 && (
        <>
          <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Alerts
          </h2>
          <Card className="p-4 mb-6 border-l-4 border-amber-500">
            <div className="space-y-2">
              {alerts?.ordersPendingStuck && alerts.ordersPendingStuck.length > 0 && (
                <p className="text-sm text-red-700">
                  Orders stuck in PENDING &gt; 10 min: {alerts.ordersPendingStuck.map((o) => o.storeName || o.id).join(', ')}
                  <Link href={`/order/${alerts.ordersPendingStuck[0]?.id}`} className="ml-2 text-primary font-medium">View</Link>
                </p>
              )}
              {alerts?.ordersReadyStuck && alerts.ordersReadyStuck.length > 0 && (
                <p className="text-sm text-red-700">
                  Orders stuck in READY_FOR_PICKUP &gt; 15 min: {alerts.ordersReadyStuck.length} orders
                  <Link href="/admin/orders?status=READY_FOR_PICKUP" className="ml-2 text-primary font-medium">Assign riders</Link>
                </p>
              )}
              {alerts?.storesClosedDuringHours && alerts.storesClosedDuringHours.length > 0 && (
                <p className="text-sm text-amber-700">
                  Stores closed during open hours: {alerts.storesClosedDuringHours.map((s) => s.name).join(', ')}
                  <Link href="/admin/stores" className="ml-2 text-primary font-medium">View</Link>
                </p>
              )}
              {alerts?.ridersInactiveOver2Hours && alerts.ridersInactiveOver2Hours.length > 0 && (
                <p className="text-sm text-amber-700">
                  Riders inactive &gt; 2 hours: {alerts.ridersInactiveOver2Hours.map((r) => r.name || r.id).join(', ')}
                  <Link href="/admin/riders" className="ml-2 text-primary font-medium">View</Link>
                </p>
              )}
            </div>
          </Card>
        </>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Link href="/admin/orders">
          <Card className="p-4 flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <Package className="w-10 h-10 text-primary" />
              <div>
                <p className="font-semibold text-slate-800">Orders</p>
                <p className="text-sm text-slate-500">Assign riders, manage orders</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </Card>
        </Link>
        <Link href="/admin/partners/new">
          <Card className="p-4 flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <DollarSign className="w-10 h-10 text-accent" />
              <div>
                <p className="font-semibold text-slate-800">Invite Partner</p>
                <p className="text-sm text-slate-500">Create rider or store invite</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </Card>
        </Link>
      </div>
    </div>
  );
}
