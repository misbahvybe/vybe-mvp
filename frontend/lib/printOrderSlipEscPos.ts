/**
 * ESC/POS receipt for 58mm (2") thermal printers.
 * Entire slip uses **double width + double height + bold** (same mode as a typical “TOTAL” line) for maximum readability.
 * Line width ≈ **16 Latin characters** per row in this mode (Font A).
 *
 * Encoding: Latin-1-safe; non-Latin-1 characters become '?'.
 */

import type { OrderSlipInput } from './printOrderSlip';
import { RECEIPT_APP_NAME, RECEIPT_DEFAULT_STORE, RECEIPT_POWERED_BY, RECEIPT_THANK_YOU } from './printOrderSlip';
import { formatOrderNo } from './orderDisplay';

/** Normal Font A width (unused when printing full slip in double-size mode). */
export const ESCPOS_58MM_COLS = 32;

/**
 * Max characters per line when `GS ! 0x11` (double W+H) is on — each glyph uses 2×2 cell; ~16 positions on 58mm.
 */
export const ESCPOS_58MM_COLS_DOUBLE = 16;

const ESC = '\x1B';
const GS = '\x1D';

export const EscPos = {
  init: `${ESC}@`,
  alignLeft: `${ESC}a\x00`,
  alignCenter: `${ESC}a\x01`,
  alignRight: `${ESC}a\x02`,
  boldOn: `${ESC}E\x01`,
  boldOff: `${ESC}E\x00`,
  sizeNormal: `${GS}!\x00`,
  sizeDoubleHeight: `${GS}!\x01`,
  /** Double width + double height — same visual weight as typical “TOTAL” on thermal printers. */
  sizeDoubleWh: `${GS}!\x11`,
  feedLines(n: number): string {
    const k = Math.max(0, Math.min(255, Math.floor(n)));
    return k ? `${ESC}d${String.fromCharCode(k)}` : '';
  },
} as const;

function num(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function money(n: number): string {
  return n.toFixed(0);
}

function escPosSafeText(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .normalize('NFC')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .split('')
        .map((ch) => {
          const c = ch.charCodeAt(0);
          if (c <= 0xff) return ch;
          return '?';
        })
        .join(''),
    )
    .join('\n');
}

function linesSubtotal(input: OrderSlipInput): number {
  return input.lines.reduce((a, l) => a + num(l.lineTotal), 0);
}

function wrapWords(text: string, maxCols: number): string[] {
  const t = escPosSafeText(text).replace(/\s+/g, ' ').trim();
  if (!t) return [''];
  const words = t.split(' ');
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxCols) cur = next;
    else {
      if (cur) out.push(cur);
      if (w.length > maxCols) {
        for (let i = 0; i < w.length; i += maxCols) out.push(w.slice(i, i + maxCols));
        cur = '';
      } else cur = w;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Left label + right value on one line (character budget = double-width columns, usually 16). */
export function escPosPadLeftRight(left: string, right: string, cols: number): string {
  const R = escPosSafeText(right);
  const maxLeft = cols - R.length - 1;
  if (maxLeft < 4) {
    return `${escPosSafeText(left).slice(0, cols)}\n${R.padStart(cols, ' ')}`;
  }
  let L = escPosSafeText(left);
  if (L.length > maxLeft) L = `${L.slice(0, Math.max(0, maxLeft - 3))}...`;
  const gap = cols - L.length - R.length;
  return `${L}${gap > 0 ? ' '.repeat(gap) : ' '}${R}`;
}

function ruleDouble(cols: number): string {
  return `${'-'.repeat(Math.min(cols, ESCPOS_58MM_COLS_DOUBLE))}\n`;
}

function formatAddressForSlip(raw: string | undefined): string {
  if (!raw?.trim()) return '—';
  const t = raw.trim();
  if (/^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/.test(t.replace(/\s/g, ''))) {
    return `Map: ${t}`;
  }
  return t;
}

/**
 * Full slip in **double W×H + bold** (matches “TOTAL” prominence throughout).
 */
export function buildOrderSlipEscPos(input: OrderSlipInput): string {
  const cols = ESCPOS_58MM_COLS_DOUBLE;
  const orderLabel = formatOrderNo(input.orderNumber, input.orderId);
  const dt = new Date(input.createdAt);
  const when = Number.isFinite(dt.getTime())
    ? dt.toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })
    : input.createdAt;

  const sub = num(input.subtotalAmount) > 0 ? num(input.subtotalAmount) : linesSubtotal(input);
  const dFee = num(input.deliveryFee);
  const sFee = num(input.serviceFee);
  const gst = num(input.gstAmount);
  const card = num(input.cardProcessingAmount);
  const disc = num(input.discountAmount);
  const total = num(input.totalAmount);

  let o = '';

  o += EscPos.init;
  o += EscPos.boldOn;
  o += EscPos.sizeDoubleWh;

  o += EscPos.alignCenter;
  for (const line of wrapWords(RECEIPT_APP_NAME.toUpperCase(), cols)) {
    o += `${line}\n`;
  }
  for (const line of wrapWords(input.storeName?.trim() || RECEIPT_DEFAULT_STORE, cols)) {
    o += `${line}\n`;
  }
  if (input.storeAddress?.trim()) {
    for (const line of wrapWords(input.storeAddress.trim(), cols)) {
      o += `${line}\n`;
    }
  }
  if (input.storePhone?.trim()) {
    for (const line of wrapWords(`Tel: ${input.storePhone.trim()}`, cols)) {
      o += `${line}\n`;
    }
  }

  o += EscPos.alignLeft;
  o += ruleDouble(cols);
  o += `${escPosPadLeftRight('Order', orderLabel, cols)}\n`;
  o += `${escPosPadLeftRight('Date', when, cols)}\n`;
  o += ruleDouble(cols);

  o += `CUSTOMER\n`;
  o += `${escPosPadLeftRight('Name', input.customerName?.trim() || '—', cols)}\n`;
  o += `${escPosPadLeftRight('Phone', input.customerPhone?.trim() || '—', cols)}\n`;
  o += `Address\n`;
  for (const line of wrapWords(formatAddressForSlip(input.deliveryAddress), cols)) {
    o += `${line}\n`;
  }

  o += ruleDouble(cols);
  o += `ITEMS\n`;

  for (const l of input.lines) {
    const qty = num(l.quantity);
    const lineTot = num(l.lineTotal);
    const unit = qty > 0 ? money(lineTot / qty) : '0';
    const name = l.name?.trim() || 'Item';
    for (const nl of wrapWords(name, cols)) {
      o += `${nl}\n`;
    }
    o += `${escPosPadLeftRight(`${qty} x ${unit}`, `Rs ${money(lineTot)}`, cols)}\n`;
    o += `\n`;
  }

  o += ruleDouble(cols);
  o += `${escPosPadLeftRight('Subtotal', `Rs${money(sub)}`, cols)}\n`;
  if (dFee > 0) o += `${escPosPadLeftRight('Delivery', `Rs${money(dFee)}`, cols)}\n`;
  if (sFee > 0) o += `${escPosPadLeftRight('Service', `Rs${money(sFee)}`, cols)}\n`;
  if (gst > 0) o += `${escPosPadLeftRight('Tax', `Rs${money(gst)}`, cols)}\n`;
  if (card > 0) o += `${escPosPadLeftRight('Card', `Rs${money(card)}`, cols)}\n`;
  if (disc > 0) o += `${escPosPadLeftRight('Disc', `-Rs${money(disc)}`, cols)}\n`;

  o += ruleDouble(cols);
  o += EscPos.alignCenter;
  o += `TOTAL\n`;
  o += `Rs ${money(total)}\n`;

  o += EscPos.alignLeft;
  for (const line of wrapWords(`Pay: ${escPosSafeText(input.paymentMethodLabel)}`, cols)) {
    o += `${line}\n`;
  }

  o += ruleDouble(cols);
  o += EscPos.alignCenter;
  for (const line of wrapWords(RECEIPT_THANK_YOU, cols)) {
    o += `${line}\n`;
  }
  for (const line of wrapWords(RECEIPT_POWERED_BY, cols)) {
    o += `${line}\n`;
  }

  o += EscPos.boldOff;
  o += EscPos.sizeNormal;
  o += EscPos.feedLines(4);

  return o;
}

export function escPosStringToUint8Array(escpos: string): Uint8Array {
  const out = new Uint8Array(escpos.length);
  for (let i = 0; i < escpos.length; i++) {
    const c = escpos.charCodeAt(i);
    out[i] = c & 0xff;
  }
  return out;
}

export function uint8ArrayToBinaryString(bytes: Uint8Array): string {
  const chunk = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunk) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + chunk)));
  }
  return parts.join('');
}

export function buildOrderSlipEscPosUint8Array(input: OrderSlipInput): Uint8Array {
  return escPosStringToUint8Array(buildOrderSlipEscPos(input));
}
