/**
 * Browser / QZ Tray printing for 58mm or 80mm thermal. Monochrome only (#000) for clean receipts.
 * Set `NEXT_PUBLIC_RECEIPT_THERMAL_MM=58` or `80` (default 58).
 */

import { formatOrderNo } from './orderDisplay';

export const RECEIPT_APP_NAME = 'Vybe Super App';
export const RECEIPT_DEFAULT_STORE = 'Vybe Store';
export const RECEIPT_THANK_YOU = 'Thank you for your order!';
export const RECEIPT_POWERED_BY = 'Powered by Vybe';

export type OrderSlipLine = {
  name: string;
  quantity: number | string;
  lineTotal: number;
};

export type OrderSlipInput = {
  /** Shown as main store title (e.g. partner store name) */
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  orderId: string;
  orderNumber?: number;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  /** Delivery / full address; coordinates get a clearer label */
  deliveryAddress?: string;
  lines: OrderSlipLine[];
  subtotalAmount?: number;
  deliveryFee?: number;
  serviceFee?: number;
  gstAmount?: number;
  cardProcessingAmount?: number;
  /** Optional discount (positive number = money off) */
  discountAmount?: number;
  totalAmount: number;
  paymentMethodLabel: string;
};

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function num(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function money(n: number): string {
  return n.toFixed(0);
}

/** If the string looks like lat,lng, label it for staff */
function formatAddressForSlip(raw: string | undefined): string {
  if (!raw?.trim()) return '—';
  const t = raw.trim();
  if (/^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/.test(t.replace(/\s/g, ''))) {
    return `Map location: ${t}`;
  }
  return t;
}

function linesSubtotal(input: OrderSlipInput): number {
  return input.lines.reduce((a, l) => a + num(l.lineTotal), 0);
}

export function getReceiptThermalWidthMm(): 58 | 80 {
  const v = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_RECEIPT_THERMAL_MM) || '58';
  return v === '80' ? 80 : 58;
}

/**
 * Map list/detail order + store profile into a slip (used by POS + dashboard + print page).
 */
export function toOrderSlipInput(
  o: {
    id: string;
    orderNumber?: number;
    createdAt: string;
    totalAmount: number | string;
    subtotalAmount?: number | string;
    deliveryFee?: number | string;
    serviceFee?: number | string;
    gstAmount?: number | string;
    cardProcessingAmount?: number | string;
    paymentMethod?: string;
    customer?: { name?: string; phone?: string };
    address?: { fullAddress?: string };
    items: { product: { name: string }; quantity: number; price: number }[];
  },
  store: { name: string; phone?: string; address?: string },
): OrderSlipInput {
  const pay = o.paymentMethod;
  return {
    storeName: store.name?.trim() || RECEIPT_DEFAULT_STORE,
    storeAddress: store.address,
    storePhone: store.phone,
    orderId: o.id,
    orderNumber: o.orderNumber,
    createdAt: o.createdAt,
    customerName: o.customer?.name,
    customerPhone: o.customer?.phone,
    deliveryAddress: o.address?.fullAddress,
    lines: o.items.map((i) => ({
      name: i.product.name,
      quantity: i.quantity,
      lineTotal: num(i.price) * num(i.quantity),
    })),
    subtotalAmount: o.subtotalAmount != null ? num(o.subtotalAmount) : undefined,
    deliveryFee: o.deliveryFee != null ? num(o.deliveryFee) : undefined,
    serviceFee: o.serviceFee != null ? num(o.serviceFee) : undefined,
    gstAmount: o.gstAmount != null ? num(o.gstAmount) : undefined,
    cardProcessingAmount: o.cardProcessingAmount != null ? num(o.cardProcessingAmount) : undefined,
    totalAmount: num(o.totalAmount),
    paymentMethodLabel:
      pay === 'COD'
        ? 'Cash on delivery (COD)'
        : pay === 'CARD'
          ? 'Card / online'
          : (pay ?? '—'),
  };
}

export function formatOrderSlipText(input: OrderSlipInput): string {
  const orderLabel = formatOrderNo(input.orderNumber, input.orderId);
  const dt = new Date(input.createdAt);
  const when = Number.isFinite(dt.getTime())
    ? dt.toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })
    : input.createdAt;
  const sub = input.subtotalAmount ?? linesSubtotal(input);
  const lines = input.lines
    .map((l) => `${l.name} x${l.quantity}  Rs ${money(num(l.lineTotal))}`)
    .join('\n');
  return [
    RECEIPT_APP_NAME,
    input.storeName,
    `Order ${orderLabel}`,
    when,
    '',
    `Customer: ${input.customerName ?? '—'}`,
    `Phone: ${input.customerPhone ?? '—'}`,
    `Address: ${formatAddressForSlip(input.deliveryAddress)}`,
    '',
    '--- Items ---',
    lines,
    '',
    `Subtotal: Rs ${money(sub)}`,
    num(input.deliveryFee) > 0 ? `Delivery: Rs ${money(num(input.deliveryFee))}` : '',
    num(input.serviceFee) > 0 ? `Service: Rs ${money(num(input.serviceFee))}` : '',
    num(input.gstAmount) > 0 ? `Tax: Rs ${money(num(input.gstAmount))}` : '',
    num(input.cardProcessingAmount) > 0 ? `Card fee: Rs ${money(num(input.cardProcessingAmount))}` : '',
    num(input.discountAmount) > 0 ? `Discount: -Rs ${money(num(input.discountAmount))}` : '',
    `TOTAL: Rs ${money(num(input.totalAmount))}`,
    `Payment: ${input.paymentMethodLabel}`,
    '',
    RECEIPT_THANK_YOU,
    RECEIPT_POWERED_BY,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildReceiptStyles(widthMm: 58 | 80): string {
  const is80 = widthMm === 80;
  const page = `${widthMm}mm auto`;
  const bodyMax = is80 ? '72mm' : '48mm';
  const base = is80 ? '13px' : '12px';
  const brand = is80 ? '11px' : '10px';
  const storeTitle = is80 ? '17px' : '15px';
  const meta = is80 ? '11px' : '10px';
  const section = is80 ? '12px' : '11px';
  const itemName = is80 ? '12px' : '11px';
  const itemDetails = is80 ? '10px' : '9px';
  const totalSize = is80 ? '18px' : '16px';
  return `
  :root { color-scheme: only light; }
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color: #000 !important;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff !important;
  }
  .receipt {
    font-family: ui-monospace, "Courier New", Courier, Consolas, monospace;
    font-size: ${base};
    line-height: 1.45;
    box-sizing: border-box;
    width: 100%;
    max-width: ${bodyMax};
    margin: 0 auto;
    padding: 3mm 2.5mm 4mm;
  }
  .brand {
    text-align: center;
    font-size: ${brand};
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin: 0 0 4px;
  }
  .store-name {
    text-align: center;
    font-size: ${storeTitle};
    font-weight: 800;
    margin: 0 0 2px;
    line-height: 1.2;
  }
  .store-meta {
    text-align: center;
    font-size: ${meta};
    font-weight: 600;
    margin: 0 0 2px;
    word-break: break-word;
  }
  .rule {
    border: none;
    border-top: 1px dashed #000;
    margin: 8px 0;
  }
  .section-h {
    font-size: ${section};
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 6px 0 4px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    margin: 3px 0;
    font-size: ${meta};
    font-weight: 600;
  }
  .row .l { flex: 1; min-width: 0; word-break: break-word; }
  .row .r { white-space: nowrap; font-weight: 700; }
  .dim { font-size: ${itemDetails}; font-weight: 600; opacity: 1; }
  .items .item { margin-bottom: 8px; }
  .items .name { font-size: ${itemName}; font-weight: 800; }
  .items .line {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 6px;
    margin-top: 2px;
  }
  .items .amt { font-weight: 800; white-space: nowrap; }
  .summary .line {
    display: flex;
    justify-content: space-between;
    margin: 4px 0;
    font-size: ${itemName};
    font-weight: 700;
  }
  .summary .grand {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 2px solid #000;
    font-size: ${totalSize};
    font-weight: 900;
  }
  .pay {
    margin: 8px 0 6px;
    font-size: ${itemName};
    font-weight: 800;
  }
  .footer {
    text-align: center;
    font-size: ${itemName};
    font-weight: 800;
    margin: 8px 0 4px;
  }
  .subfoot {
    text-align: center;
    font-size: ${itemDetails};
    font-weight: 700;
    margin: 0;
  }
  @page { size: ${page}; margin: 2.5mm; }
  @media print {
    html, body { background: #fff !important; }
    .receipt { padding: 0; max-width: none; }
  }
`;
}

/**
 * Full HTML document for thermal slip. QZ Tray + browser print.
 */
export function buildOrderSlipHtmlDocument(input: OrderSlipInput, options?: { autoPrintScript?: boolean }): string {
  const widthMm = getReceiptThermalWidthMm();
  const autoPrint = options?.autoPrintScript !== false;
  const printScript = autoPrint ? '<script>window.onload=function(){window.print();};</script>' : '';
  const orderLabel = formatOrderNo(input.orderNumber, input.orderId);
  const when = Number.isFinite(new Date(input.createdAt).getTime())
    ? new Date(input.createdAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })
    : input.createdAt;
  const sub = num(input.subtotalAmount) > 0 ? num(input.subtotalAmount) : linesSubtotal(input);
  const dFee = num(input.deliveryFee);
  const sFee = num(input.serviceFee);
  const gst = num(input.gstAmount);
  const card = num(input.cardProcessingAmount);
  const disc = num(input.discountAmount);
  const total = num(input.totalAmount);

  const itemRows = input.lines
    .map(
      (l) => `
    <div class="item">
      <div class="name">${esc(l.name)}</div>
      <div class="line">
        <span class="dim">${esc(String(l.quantity))} × Rs ${money(num(l.lineTotal) / Math.max(1, num(l.quantity)))}</span>
        <span class="amt">Rs ${money(num(l.lineTotal))}</span>
      </div>
    </div>`,
    )
    .join('');

  const summaryRows: string[] = [];
  summaryRows.push(`<div class="line"><span>Subtotal</span><span>Rs ${money(sub)}</span></div>`);
  if (dFee > 0) summaryRows.push(`<div class="line"><span>Delivery</span><span>Rs ${money(dFee)}</span></div>`);
  if (sFee > 0) summaryRows.push(`<div class="line"><span>Service fee</span><span>Rs ${money(sFee)}</span></div>`);
  if (gst > 0) summaryRows.push(`<div class="line"><span>Tax</span><span>Rs ${money(gst)}</span></div>`);
  if (card > 0) summaryRows.push(`<div class="line"><span>Card fee</span><span>Rs ${money(card)}</span></div>`);
  if (disc > 0) summaryRows.push(`<div class="line"><span>Discount</span><span>−Rs ${money(disc)}</span></div>`);

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="color-scheme" content="light"/>
<meta name="supported-color-schemes" content="light"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Order ${esc(orderLabel)}</title>
<style>${buildReceiptStyles(widthMm)}</style>
</head>
<body>
  <div class="receipt">
    <div class="brand">${esc(RECEIPT_APP_NAME)}</div>
    <div class="store-name">${esc(input.storeName || RECEIPT_DEFAULT_STORE)}</div>
    ${input.storeAddress ? `<div class="store-meta">${esc(input.storeAddress)}</div>` : ''}
    ${input.storePhone ? `<div class="store-meta">Tel: ${esc(input.storePhone)}</div>` : ''}
    <hr class="rule"/>
    <div class="row"><span class="l">Order</span><span class="r">${esc(orderLabel)}</span></div>
    <div class="row"><span class="l">Date &amp; time</span><span class="r" style="text-align:right;max-width:58%">${esc(when)}</span></div>
    <hr class="rule"/>
    <div class="section-h">Customer</div>
    <div class="row"><span class="l">Name</span><span class="r" style="text-align:right;max-width:60%;white-space:normal">${esc(input.customerName ?? '—')}</span></div>
    <div class="row"><span class="l">Phone</span><span class="r">${esc(input.customerPhone ?? '—')}</span></div>
    <div class="row" style="align-items:flex-start"><span class="l">Address</span><span class="r" style="text-align:right;max-width:62%;white-space:normal">${esc(formatAddressForSlip(input.deliveryAddress))}</span></div>
    <hr class="rule"/>
    <div class="section-h">Items</div>
    <div class="items">${itemRows}</div>
    <hr class="rule"/>
    <div class="summary">
      ${summaryRows.join('')}
      <div class="grand"><span>TOTAL</span><span>Rs ${money(total)}</span></div>
    </div>
    <div class="pay">Payment: ${esc(input.paymentMethodLabel)}</div>
    <hr class="rule"/>
    <div class="footer">${esc(RECEIPT_THANK_YOU)}</div>
    <p class="subfoot">${esc(RECEIPT_POWERED_BY)}</p>
  </div>
  ${printScript}
</body></html>`;
}

export function printOrderSlip(input: OrderSlipInput): void {
  if (typeof window === 'undefined') return;
  const w = window.open('', '_blank');
  if (!w) {
    window.alert('Allow pop-ups for this site to print the order slip.');
    return;
  }
  w.document.write(buildOrderSlipHtmlDocument(input, { autoPrintScript: true }));
  w.document.close();
}
