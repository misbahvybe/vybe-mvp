/**
 * ESC/POS receipt for 58mm (2") thermal printers — Font A ≈ 32 columns at normal width.
 * Uses bold, double width+height for header/total, and left/right alignment for rows.
 *
 * Encoding: bytes are Latin-1 (ISO-8859-1); non-Latin-1 characters become '?'.
 * For Urdu/emoji store names, configure the printer for UTF-8/code page or pre-transliterate.
 */

import type { OrderSlipInput } from './printOrderSlip';
import { RECEIPT_APP_NAME, RECEIPT_DEFAULT_STORE, RECEIPT_POWERED_BY, RECEIPT_THANK_YOU } from './printOrderSlip';
import { formatOrderNo } from './orderDisplay';

/** Printable columns at normal character width (58mm, Font A). */
export const ESCPOS_58MM_COLS = 32;

const ESC = '\x1B';
const GS = '\x1D';

export const EscPos = {
  init: `${ESC}@`,
  alignLeft: `${ESC}a\x00`,
  alignCenter: `${ESC}a\x01`,
  alignRight: `${ESC}a\x02`,
  boldOn: `${ESC}E\x01`,
  boldOff: `${ESC}E\x00`,
  /** Normal size (1×1). */
  sizeNormal: `${GS}!\x00`,
  /** Double height only — keeps ~32 columns, much taller glyphs (best for item/body text). */
  sizeDoubleHeight: `${GS}!\x01`,
  /** Double width + double height (max ~16 Latin chars per line on 58mm). */
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

/** Map string to Latin-1 bytes-safe chars for cheap ESC/POS stacks. */
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

/** Left label + right value on one line (normal width). */
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

function rule(cols: number): string {
  return `${'-'.repeat(Math.min(cols, 32))}\n`;
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
 * Builds the full ESC/POS command string (binary; treat as Latin-1 when sending to printer).
 */
export function buildOrderSlipEscPos(input: OrderSlipInput): string {
  const cols = ESCPOS_58MM_COLS;
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
  o += EscPos.alignCenter;
  o += EscPos.sizeDoubleWh;
  o += EscPos.boldOn;
  for (const line of wrapWords(RECEIPT_APP_NAME.toUpperCase(), 16)) {
    o += `${line}\n`;
  }
  o += EscPos.sizeNormal;
  o += EscPos.sizeDoubleHeight;
  o += EscPos.boldOn;
  for (const line of wrapWords(input.storeName?.trim() || RECEIPT_DEFAULT_STORE, cols)) {
    o += `${line}\n`;
  }
  if (input.storeAddress?.trim()) {
    for (const line of wrapWords(input.storeAddress.trim(), cols)) {
      o += `${line}\n`;
    }
  }
  if (input.storePhone?.trim()) {
    o += `${escPosSafeText(`Tel: ${input.storePhone.trim()}`)}\n`;
  }
  o += EscPos.sizeNormal;
  o += EscPos.boldOff;

  o += EscPos.alignLeft;
  o += rule(cols);
  o += EscPos.sizeDoubleHeight;
  o += EscPos.boldOn;
  o += `${escPosPadLeftRight('Order', orderLabel, cols)}\n`;
  o += `${escPosPadLeftRight('Date & time', when, cols)}\n`;
  o += EscPos.sizeNormal;
  o += EscPos.boldOff;
  o += rule(cols);

  o += EscPos.sizeDoubleHeight;
  o += EscPos.boldOn;
  o += `CUSTOMER\n`;
  o += `${escPosPadLeftRight('Name', input.customerName?.trim() || '—', cols)}\n`;
  o += `${escPosPadLeftRight('Phone', input.customerPhone?.trim() || '—', cols)}\n`;
  o += `Address\n`;
  for (const line of wrapWords(formatAddressForSlip(input.deliveryAddress), cols)) {
    o += `${line}\n`;
  }
  o += EscPos.sizeNormal;
  o += EscPos.boldOff;

  o += rule(cols);
  o += EscPos.sizeDoubleHeight;
  o += EscPos.boldOn;
  o += `ITEMS\n`;
  o += EscPos.sizeNormal;
  o += EscPos.boldOff;

  for (const l of input.lines) {
    const qty = num(l.quantity);
    const lineTot = num(l.lineTotal);
    const unit = qty > 0 ? money(lineTot / qty) : '0';
    const name = l.name?.trim() || 'Item';
    o += EscPos.sizeDoubleHeight;
    o += EscPos.boldOn;
    for (const nl of wrapWords(name, cols)) {
      o += `${nl}\n`;
    }
    o += `${escPosPadLeftRight(`  ${qty} x Rs ${unit}`, `Rs ${money(lineTot)}`, cols)}\n`;
    o += EscPos.sizeNormal;
    o += EscPos.boldOff;
    o += `\n`;
  }

  o += rule(cols);
  o += EscPos.sizeDoubleHeight;
  o += EscPos.boldOn;
  o += `${escPosPadLeftRight('Subtotal', `Rs ${money(sub)}`, cols)}\n`;
  if (dFee > 0) o += `${escPosPadLeftRight('Delivery', `Rs ${money(dFee)}`, cols)}\n`;
  if (sFee > 0) o += `${escPosPadLeftRight('Service fee', `Rs ${money(sFee)}`, cols)}\n`;
  if (gst > 0) o += `${escPosPadLeftRight('Tax', `Rs ${money(gst)}`, cols)}\n`;
  if (card > 0) o += `${escPosPadLeftRight('Card fee', `Rs ${money(card)}`, cols)}\n`;
  if (disc > 0) o += `${escPosPadLeftRight('Discount', `-Rs ${money(disc)}`, cols)}\n`;
  o += EscPos.sizeNormal;
  o += EscPos.boldOff;

  o += rule(cols);
  o += EscPos.alignCenter;
  o += EscPos.sizeDoubleWh;
  o += EscPos.boldOn;
  o += `TOTAL\n`;
  o += `Rs ${money(total)}\n`;
  o += EscPos.sizeNormal;
  o += EscPos.boldOff;

  o += EscPos.alignLeft;
  o += EscPos.sizeDoubleHeight;
  o += EscPos.boldOn;
  o += `${escPosPadLeftRight('Payment', escPosSafeText(input.paymentMethodLabel), cols)}\n`;
  o += EscPos.sizeNormal;
  o += EscPos.boldOff;
  o += rule(cols);
  o += EscPos.alignCenter;
  o += EscPos.sizeDoubleHeight;
  o += EscPos.boldOn;
  o += `${RECEIPT_THANK_YOU}\n`;
  o += EscPos.sizeNormal;
  o += EscPos.boldOff;
  o += EscPos.boldOn;
  o += `${RECEIPT_POWERED_BY}\n`;
  o += EscPos.boldOff;
  o += EscPos.feedLines(4);

  return o;
}

/** Convert ESC/POS string to bytes (Latin-1). Safe for fetch/QZ/binary transport. */
export function escPosStringToUint8Array(escpos: string): Uint8Array {
  const out = new Uint8Array(escpos.length);
  for (let i = 0; i < escpos.length; i++) {
    const c = escpos.charCodeAt(i);
    out[i] = c & 0xff;
  }
  return out;
}

/** For QZ Tray / drivers that expect a binary JS string. */
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
