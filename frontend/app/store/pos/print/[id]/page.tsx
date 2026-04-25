'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import api from '@/services/api';
import { Loader } from '@/components/ui/Loader';
import { buildOrderSlipHtmlDocument, RECEIPT_DEFAULT_STORE, toOrderSlipInput } from '@/lib/printOrderSlip';

type OrderDetail = {
  id: string;
  orderNumber?: number;
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

function mapDetailToStore(order: OrderDetail) {
  return {
    name: order.store?.name?.trim() || RECEIPT_DEFAULT_STORE,
    phone: order.store?.phone,
    address: order.store?.address,
  };
}

function mapDetailToSlipInput(order: OrderDetail) {
  return toOrderSlipInput(
    {
      id: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      totalAmount: order.totalAmount,
      subtotalAmount: order.subtotalAmount,
      deliveryFee: order.deliveryFee,
      serviceFee: order.serviceFee,
      gstAmount: order.gstAmount,
      cardProcessingAmount: order.cardProcessingAmount,
      paymentMethod: order.paymentMethod,
      customer: { name: order.customer?.name, phone: order.customer?.phone },
      address: { fullAddress: order.address?.fullAddress },
      items: (order.items ?? []).map((it) => ({
        product: { name: it.product?.name ?? 'Item' },
        quantity: Number(it.quantity),
        price: Number(it.price),
      })),
    },
    mapDetailToStore(order),
  );
}

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
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

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

  const receiptHtml = useMemo(() => {
    if (!order) return '';
    return buildOrderSlipHtmlDocument(mapDetailToSlipInput(order), { autoPrintScript: false });
  }, [order]);

  const forceAutoPrint = searchParams?.get('autoprint') === '1';

  const runPrint = useCallback(() => {
    try {
      const w = iframeRef.current?.contentWindow;
      if (w) w.print();
      else window.print();
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!order || !receiptHtml) return;
    if (ctx.isAndroid && !forceAutoPrint) return;
    const t = setTimeout(() => runPrint(), 400);
    return () => clearTimeout(t);
  }, [order, receiptHtml, ctx.isAndroid, forceAutoPrint, runPrint]);

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size={44} />
      </div>
    );
  }

  return (
    <div className="p-3 min-h-screen bg-slate-50">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-root { background: #fff !important; padding: 0 !important; }
        }
      `}</style>
      <div className="print-root">
      <div className="no-print mb-3 space-y-2 max-w-lg mx-auto">
        {ctx.isAndroid ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <p className="font-semibold">Android / Sunmi</p>
            <p className="mt-1 text-xs leading-relaxed">
              Use <strong>Print to thermal</strong> and pick your 58mm printer. Enable pop-ups for this site if the receipt does not
              show.
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runPrint}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium"
          >
            Print to thermal
          </button>
          <button type="button" onClick={runPrint} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">
            Print again
          </button>
        </div>
      </div>
      <div className="max-w-md mx-auto bg-white rounded-lg shadow border border-slate-200 overflow-hidden print:shadow-none print:border-0">
        <iframe
          ref={iframeRef}
          title="Order receipt"
          className="w-full min-h-[70vh] border-0"
          srcDoc={receiptHtml}
        />
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
