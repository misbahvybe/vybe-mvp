'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
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

/** Sunmi V2 / V2 PRO built-in roll is 58mm; Chrome cannot drive inner printer — user picks system print target. */
function detectPrintContext() {
  if (typeof navigator === 'undefined') {
    return { isAndroid: false, isSunmi: false, ua: '' };
  }
  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isSunmi = /Sunmi|SUNMI|sunmi|WITVOER/i.test(ua) || /V2\s*PRO/i.test(ua);
  return { isAndroid, isSunmi, ua };
}

function StorePosPrintInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = String(params?.id ?? '');
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [ctx, setCtx] = useState({ isAndroid: false, isSunmi: false, ua: '' });

  useEffect(() => {
    setCtx(detectPrintContext());
  }, []);

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

  const forceAutoPrint = searchParams?.get('autoprint') === '1';

  useEffect(() => {
    if (!order) return;
    // Android / Sunmi: auto-print is unreliable (no direct inner-printer access from Chrome).
    // User taps "Print to thermal" → Android print UI → pick Sunmi / Inner printer / default.
    if (ctx.isAndroid && !forceAutoPrint) return;
    const t = setTimeout(() => {
      try {
        window.print();
      } catch {
        // ignore
      }
    }, 300);
    return () => clearTimeout(t);
  }, [order, ctx.isAndroid, forceAutoPrint]);

  const triggerPrint = () => {
    try {
      window.print();
    } catch {
      // ignore
    }
  };

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
    <div className="p-3">
      <style>{`
        /* Sunmi V2 / V2 PRO: 58mm thermal; keep layout narrow like ~32–48 chars */
        @page { size: 58mm auto; margin: 2mm; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        .ticket {
          max-width: 58mm;
          margin: 0 auto;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 11px;
          line-height: 1.35;
          color: #0f172a;
        }
        .ticket h1 { font-size: 14px; margin: 0 0 4px; font-weight: 700; }
        .muted { color: #475569; }
        .row { display: flex; justify-content: space-between; gap: 6px; }
        .hr { border-top: 1px dashed #64748b; margin: 8px 0; }
        .item-name { word-break: break-word; flex: 1; min-width: 0; }
      `}</style>

      <div className="no-print mb-3 space-y-2">
        {ctx.isAndroid ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <p className="font-semibold">Sunmi / Android</p>
            <p className="mt-1 text-xs leading-relaxed">
              Chrome cannot open the built-in Sunmi printer directly. Tap <strong>Print to thermal</strong>, then in the
              system dialog choose your <strong>inner / built-in thermal printer</strong> (wording varies by ROM).
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={triggerPrint} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium">
            Print to thermal
          </button>
          <button type="button" onClick={triggerPrint} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">
            Print again
          </button>
        </div>
      </div>

      <div className="ticket">
        <div style={{ textAlign: 'center' }}>
          <h1>{order.store?.name ?? 'Vybe Store'}</h1>
          <div className="muted" style={{ fontSize: '10px' }}>
            {order.store?.address ?? order.address?.city ?? ''}
          </div>
          {order.store?.phone ? <div className="muted" style={{ fontSize: '10px' }}>{order.store.phone}</div> : null}
        </div>

        <div className="hr" />

        <div className="row">
          <span>Order</span>
          <span style={{ fontWeight: 700 }}>{code}</span>
        </div>
        <div className="row">
          <span className="muted">Time</span>
          <span className="muted" style={{ textAlign: 'right' }}>
            {created}
          </span>
        </div>
        <div className="row">
          <span className="muted">Payment</span>
          <span className="muted">{isCod ? 'COD' : 'PAID'}</span>
        </div>
        {order.customer?.name || order.customer?.phone ? (
          <div className="row" style={{ marginTop: 4 }}>
            <span className="muted">Customer</span>
            <span className="muted" style={{ textAlign: 'right', maxWidth: '65%' }}>
              {[order.customer?.name, order.customer?.phone].filter(Boolean).join(' · ')}
            </span>
          </div>
        ) : null}

        <div className="hr" />

        <div style={{ fontWeight: 700, marginBottom: 4 }}>Items</div>
        <div>
          {(order.items ?? []).map((it, idx) => (
            <div key={idx} style={{ marginBottom: 6 }}>
              <div className="row">
                <span className="item-name">{it.product?.name ?? 'Item'}</span>
                <span style={{ whiteSpace: 'nowrap' }}>Rs {money(n(it.price) * n(it.quantity))}</span>
              </div>
              <div className="muted" style={{ fontSize: '10px' }}>
                {n(it.quantity)} × Rs {money(it.price)}
              </div>
            </div>
          ))}
        </div>

        <div className="hr" />

        <div className="row">
          <span className="muted">Items total</span>
          <span className="muted">Rs {money(itemsTotal)}</span>
        </div>
        {n(order.deliveryFee) > 0 ? (
          <div className="row">
            <span className="muted">Delivery</span>
            <span className="muted">Rs {money(order.deliveryFee)}</span>
          </div>
        ) : null}
        {n(order.serviceFee) > 0 ? (
          <div className="row">
            <span className="muted">Service fee</span>
            <span className="muted">Rs {money(order.serviceFee)}</span>
          </div>
        ) : null}
        {n(order.gstAmount) > 0 ? (
          <div className="row">
            <span className="muted">Tax</span>
            <span className="muted">Rs {money(order.gstAmount)}</span>
          </div>
        ) : null}
        {n(order.cardProcessingAmount) > 0 ? (
          <div className="row">
            <span className="muted">Card fee</span>
            <span className="muted">Rs {money(order.cardProcessingAmount)}</span>
          </div>
        ) : null}

        <div className="row" style={{ marginTop: 8, fontWeight: 700, fontSize: '13px' }}>
          <span>Total</span>
          <span>Rs {money(order.totalAmount)}</span>
        </div>

        {order.address?.fullAddress ? (
          <>
            <div className="hr" />
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Delivery address</div>
            <div className="muted" style={{ fontSize: '10px', whiteSpace: 'pre-wrap' }}>
              {order.address.fullAddress}
            </div>
          </>
        ) : null}

        <div className="hr" />
        <div style={{ textAlign: 'center' }} className="muted">
          Thank you — Vybe
        </div>
      </div>
    </div>
  );
}

export default function StorePosPrintPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader size={44} />
        </div>
      }
    >
      <StorePosPrintInner />
    </Suspense>
  );
}
