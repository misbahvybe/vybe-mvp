/**
 * Browser printing for 58mm thermal (or system default). Pair the printer in the OS and pick it
 * in the print dialog; auto-print after Accept triggers the same dialog.
 */

import { formatOrderNo } from './orderDisplay';

export type OrderSlipLine = {
  name: string;
  quantity: number | string;
  lineTotal: number;
};

export type OrderSlipInput = {
  storeName: string;
  orderId: string;
  orderNumber?: number;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  lines: OrderSlipLine[];
  totalAmount: number;
  paymentMethodLabel: string;
};

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatOrderSlipText(input: OrderSlipInput): string {
  const num = formatOrderNo(input.orderNumber, input.orderId);
  const dt = new Date(input.createdAt);
  const when = Number.isFinite(dt.getTime())
    ? dt.toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })
    : input.createdAt;
  const lines = input.lines
    .map((l) => `${l.name} x${l.quantity}  Rs ${Number(l.lineTotal).toFixed(0)}`)
    .join('\n');
  return [
    input.storeName,
    `Order ${num}`,
    when,
    '',
    `Customer: ${input.customerName ?? '—'}`,
    `Phone: ${input.customerPhone ?? '—'}`,
    `Address: ${input.deliveryAddress ?? '—'}`,
    '',
    '--- Items ---',
    lines,
    '',
    `TOTAL: Rs ${Number(input.totalAmount).toFixed(0)}`,
    `Payment: ${input.paymentMethodLabel}`,
  ].join('\n');
}

/** Opens print dialog with a 58mm receipt layout (white paper, black text). */
export function printOrderSlip(input: OrderSlipInput): void {
  if (typeof window === 'undefined') return;
  const w = window.open('', '_blank');
  if (!w) {
    window.alert('Allow pop-ups for this site to print the order slip.');
    return;
  }
  const body = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="color-scheme" content="light"/>
<meta name="supported-color-schemes" content="light"/>
<title>Order ${esc(formatOrderNo(input.orderNumber, input.orderId))}</title>
<style>
  :root { color-scheme: only light; }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff !important;
    color: #000000 !important;
  }
  body {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 11px;
    line-height: 1.35;
    box-sizing: border-box;
    width: 100%;
    max-width: 50mm;
    margin: 0 auto;
    padding: 6px 4px 10px;
  }
  h1 { font-size: 13px; margin: 0 0 6px; font-weight: 700; color: #000; }
  .muted { color: #333; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; color: #000; }
  td { padding: 4px 0; vertical-align: top; color: #000; }
  td:last-child { text-align: right; }
  .total { font-weight: bold; border-top: 1px dashed #333; padding-top: 8px; margin-top: 8px; color: #000; }
  p { margin: 0 0 8px; color: #000; }
  @page { size: 58mm auto; margin: 3mm; }
  @media print {
    html, body { background: #fff !important; color: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { padding: 0; max-width: none; }
  }
</style></head>
<body>
  <h1>${esc(input.storeName)}</h1>
  <div class="muted">Order ${esc(formatOrderNo(input.orderNumber, input.orderId))}</div>
  <div class="muted">${esc(
    Number.isFinite(new Date(input.createdAt).getTime())
      ? new Date(input.createdAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })
      : input.createdAt,
  )}</div>
  <p><strong>Customer:</strong> ${esc(input.customerName ?? '—')}<br/>
  <strong>Phone:</strong> ${esc(input.customerPhone ?? '—')}<br/>
  <strong>Address:</strong> ${esc(input.deliveryAddress ?? '—')}</p>
  <table>
    ${input.lines
      .map(
        (l) =>
          `<tr><td>${esc(l.name)} × ${esc(String(l.quantity))}</td><td>Rs ${Number(l.lineTotal).toFixed(0)}</td></tr>`,
      )
      .join('')}
  </table>
  <div class="total">Total: Rs ${Number(input.totalAmount).toFixed(0)}</div>
  <div>Payment: ${esc(input.paymentMethodLabel)}</div>
  <script>window.onload=function(){window.print();};</script>
</body></html>`;
  w.document.write(body);
  w.document.close();
}
