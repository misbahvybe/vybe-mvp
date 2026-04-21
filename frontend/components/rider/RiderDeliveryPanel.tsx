'use client';

import { MapPin, Package, Check, X, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getRiderDeliveryUiState, riderStepLabels } from '@/lib/riderDeliveryFlow';

function googleMapsUrl(lat?: number | string, lng?: number | string, address?: string): string {
  const la = lat != null ? Number(lat) : null;
  const ln = lng != null ? Number(lng) : null;
  if (la != null && ln != null && !isNaN(la) && !isNaN(ln)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${la},${ln}`;
  }
  if (address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  }
  return 'https://www.google.com/maps';
}

type OrderShape = {
  id: string;
  orderStatus: string;
  riderId?: string | null;
  riderArrivedAt?: string | null;
  store?: { latitude?: number; longitude?: number; address?: string };
  address?: { latitude?: number; longitude?: number; fullAddress?: string };
};

type Props = {
  order: OrderShape;
  riderId: string;
  loading: boolean;
  onAccept: () => void;
  onReject: () => void;
  onArrived: () => void;
  onPickup: () => void;
  onDeliver: () => void;
};

export function RiderDeliveryPanel({
  order,
  riderId,
  loading,
  onAccept,
  onReject,
  onArrived,
  onPickup,
  onDeliver,
}: Props) {
  const ui = getRiderDeliveryUiState(order, riderId);
  if (!ui) {
    if (order.riderId !== riderId) return null;
    const terminal = order.orderStatus === 'DELIVERED' || order.orderStatus === 'CANCELLED';
    if (terminal) return null;
    return (
      <p className="text-sm text-slate-600">
        No rider action is available for this status ({order.orderStatus}). Pull to refresh or open support if this persists.
      </p>
    );
  }

  const labels = riderStepLabels();
  const storeUrl = googleMapsUrl(order.store?.latitude, order.store?.longitude, order.store?.address);
  const customerUrl = googleMapsUrl(order.address?.latitude, order.address?.longitude, order.address?.fullAddress);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((n) => {
          const active = n === ui.highlightStep;
          const done = n < ui.highlightStep && !ui.waitingForKitchen;
          return (
            <div key={n} className="flex-1 flex flex-col items-center min-w-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  active
                    ? 'bg-primary text-white ring-2 ring-primary/30'
                    : done
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-500'
                }`}
              >
                {done ? '✓' : n}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 text-center leading-tight px-0.5">
                {labels[n - 1]}
              </span>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">{ui.title}</p>
        <p className="text-sm text-slate-600 mt-1">{ui.instruction}</p>
      </div>

      {ui.waitingForKitchen && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Stay nearby — you will unlock pickup as soon as the restaurant marks the order ready.
        </p>
      )}

      {(ui.showNavigateToStore || ui.showNavigateToCustomer) && (
        <div className="flex flex-wrap gap-2">
          {ui.showNavigateToStore && (
            <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex">
              <Button type="button" variant="outline" size="sm" className="min-h-[40px]">
                <Navigation className="w-4 h-4 mr-2 shrink-0" />
                Navigate to restaurant
              </Button>
            </a>
          )}
          {ui.showNavigateToCustomer && (
            <a href={customerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex">
              <Button type="button" variant="outline" size="sm" className="min-h-[40px]">
                <MapPin className="w-4 h-4 mr-2 shrink-0" />
                Navigate to customer
              </Button>
            </a>
          )}
        </div>
      )}

      <div className="pt-1">
        {ui.primary === 'ACCEPT_ASSIGNMENT' && (
          <div className="flex gap-2">
            <Button
              size="lg"
              fullWidth
              loading={loading}
              onClick={onAccept}
              className="min-h-[48px]"
            >
              <Check className="w-5 h-5 mr-2 inline" />
              Accept
            </Button>
            {order.orderStatus === 'RIDER_ASSIGNED' && (
              <Button
                size="lg"
                variant="outline"
                disabled={loading}
                onClick={onReject}
                className="min-h-[48px] shrink-0 px-4"
                aria-label="Reject assignment"
              >
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>
        )}

        {ui.primary === 'MARK_ARRIVED' && (
          <Button size="lg" fullWidth loading={loading} onClick={onArrived} className="min-h-[48px]">
            <MapPin className="w-5 h-5 mr-2 inline" />
            Arrived
          </Button>
        )}

        {ui.primary === 'CONFIRM_PICKUP' && (
          <Button size="lg" fullWidth loading={loading} onClick={onPickup} className="min-h-[48px]">
            <Package className="w-5 h-5 mr-2 inline" />
            Pickup
          </Button>
        )}

        {ui.primary === 'CONFIRM_DELIVER' && (
          <Button size="lg" fullWidth loading={loading} onClick={onDeliver} className="min-h-[48px]">
            Deliver
          </Button>
        )}
      </div>
    </div>
  );
}
