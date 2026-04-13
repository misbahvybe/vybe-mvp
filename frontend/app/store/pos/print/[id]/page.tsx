'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/services/api';
import { Loader } from '@/components/ui/Loader';

type OrderDetail = {
  id: string;
  createdAt: string;
  orderStatus: string;
  paymentMethod?: string;
  paymentStatus?: string;
  subtotalAmount?: string | number;
  deliveryFee?: string | number;
  serviceFee?: string | number;
  gstAmount?: string | number;
  cardProcessingAmount?: string | number;
  totalAmount: string | number;
  store?: { name?: string; phone?: string; address?: string };
  customer?: { name?: string; phone?: string };
  address?: { fullAddress?: string; city?: string };
  items: { product?: { name?: string }; quantity: string | number; price: string | number }[];
};

function n(v: unknown) {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function money(v: unknown) {
  return n(v).toFixed(0);
}

export default function StorePosPrintPage() {
  const params = useParams();
  const id = String(params?.id ?? '');
  const [order, setOrder] = useState<OrderDetail | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .get(`/orders/${id}`)
      .then((r) => setOrder(r.data ?? null))
      .catch(() => setOrder(null));
  }, [id]);

  const itemsTotal = useMemo(() => {
    if (!order) return 0;
    return (order.items ?? []).reduce((acc, it) => acc + n(it.price) * n(it.quantity), 0);
  }, [order]);

  useEffect(() => {
    if (!order) return;
    const t = setTimeout(() => {
      try {
        window.print();
      } catch {
        // ignore
      }
    }, 250);
    return () => clearTimeout(t);
  }, [order]);

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size={44} />
      </div>
    );
  }

  const code = `#${order.id.slice(-8).toUpperCase()}`;
  const created = new Date(order.createdAt).toLocaleString();
  const isCod = order.paymentMethod === 'COD';

  return (
    <div className="p-4">
      <style>{`
        @page { size: 80mm auto; margin: 6mm; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        .ticket { max-width: 80mm; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
        .muted { color: #475569; }
        .row { display: flex; justify-content: space-between; gap: 8px; }
        .hr { border-top: 1px dashed #94a3b8; margin: 10px 0; }
      `}</style>

      <div className="no-print mb-3">
        <button onClick={() => window.print()} className="px-3 py-2 border rounded">
          Print again
        </button>
      </div>

      <div className="ticket">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '16px' }}>{order.store?.name ?? 'Vybe Store'}</div>
          <div className="muted" style={{ fontSize: '12px', marginTop: '2px' }}>
            {order.store?.address ?? order.address?.city ?? ''}
          </div>
          {order.store?.phone ? (
            <div className="muted" style={{ fontSize: '12px' }}>
              {order.store.phone}
            </div>
          ) : null}
        </div>

        <div className="hr" />

        <div className="row">
          <div>Order</div>
          <div style={{ fontWeight: 700 }}>{code}</div>
        </div>
        <div className="row">
          <div className="muted">Time</div>
          <div className="muted">{created}</div>
        </div>
        <div className="row">
          <div className="muted">Payment</div>
          <div className="muted">{isCod ? 'COD' : 'PAID'}</div>
        </div>

        <div className="hr" />

        <div style={{ fontWeight: 700 }}>Items</div>
        <div style={{ marginTop: '6px' }}>
          {(order.items ?? []).map((it, idx) => (
            <div key={idx} style={{ marginBottom: '6px' }}>
              <div className="row">
                <div style={{ flex: 1, wordBreak: 'break-word' }}>{it.product?.name ?? 'Item'}</div>
                <div style={{ whiteSpace: 'nowrap' }}>Rs {money(n(it.price) * n(it.quantity))}</div>
              </div>
              <div className="muted" style={{ fontSize: '12px' }}>
                {n(it.quantity)} × Rs {money(it.price)}
              </div>
            </div>
          ))}
        </div>

        <div className="hr" />

        <div className="row">
          <div className="muted">Items total</div>
          <div className="muted">Rs {money(itemsTotal)}</div>
        </div>
        {n(order.deliveryFee) > 0 ? (
          <div className="row">
            <div className="muted">Delivery</div>
            <div className="muted">Rs {money(order.deliveryFee)}</div>
          </div>
        ) : null}
        {n(order.serviceFee) > 0 ? (
          <div className="row">
            <div className="muted">Service fee</div>
            <div className="muted">Rs {money(order.serviceFee)}</div>
          </div>
        ) : null}
        {n(order.gstAmount) > 0 ? (
          <div className="row">
            <div className="muted">Tax</div>
            <div className="muted">Rs {money(order.gstAmount)}</div>
          </div>
        ) : null}
        {n(order.cardProcessingAmount) > 0 ? (
          <div className="row">
            <div className="muted">Card fee</div>
            <div className="muted">Rs {money(order.cardProcessingAmount)}</div>
          </div>
        ) : null}

        <div className="row" style={{ marginTop: '8px', fontWeight: 700, fontSize: '16px' }}>
          <div>Total</div>
          <div>Rs {money(order.totalAmount)}</div>
        </div>

        {order.address?.fullAddress ? (
          <>
            <div className="hr" />
            <div style={{ fontWeight: 700 }}>Delivery address</div>
            <div className="muted" style={{ fontSize: '12px', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
              {order.address.fullAddress}
            </div>
          </>
        ) : null}

        <div className="hr" />
        <div style={{ textAlign: 'center' }} className="muted">
          Thank you
        </div>
      </div>
    </div>
  );
}

