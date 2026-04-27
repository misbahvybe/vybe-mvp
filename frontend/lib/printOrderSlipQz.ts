/**
 * QZ Tray integration: prints the same 58mm HTML receipt without the browser print dialog.
 *
 * Setup (restaurant PC / tablet):
 * 1. Install QZ Tray from https://qz.io/download/
 * 2. Pair the thermal printer in Windows so it appears under Settings → Printers
 * 3. Copy the exact printer name (e.g. "POS-58") into `NEXT_PUBLIC_QZ_TRAY_PRINTER_NAME` in Vercel/your env and redeploy
 * 4. First visit: allow QZ Tray when prompted; production sites need a signed certificate (see https://qz.io/wiki/Signing)
 *
 * If QZ is missing or print fails, callers fall back to `printOrderSlip` (popup + system dialog).
 *
 * Raw ESC/POS (bold / double-size for 58mm): set `NEXT_PUBLIC_QZ_TRAY_USE_RAW_ESC_POS=true` so the
 * driver receives native thermal commands instead of rasterized HTML (crisper on many POS units).
 */

import type { OrderSlipInput } from './printOrderSlip';
import { buildOrderSlipHtmlDocument, printOrderSlip } from './printOrderSlip';
import { buildOrderSlipEscPosUint8Array, uint8ArrayToBinaryString } from './printOrderSlipEscPos';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Qz = any;

function getPrinterNameFromEnv(): string {
  if (typeof process === 'undefined') return '';
  return (process.env.NEXT_PUBLIC_QZ_TRAY_PRINTER_NAME ?? '').trim();
}

export function isQzTrayEnvConfigured(): boolean {
  return getPrinterNameFromEnv().length > 0;
}

/** Exposed for UI (POS “printing mode” chip). */
export function getQzTrayPrinterName(): string {
  return getPrinterNameFromEnv();
}

function useQzRawEscPos(): boolean {
  if (typeof process === 'undefined') return false;
  const v = (process.env.NEXT_PUBLIC_QZ_TRAY_USE_RAW_ESC_POS ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

async function loadQz(): Promise<Qz> {
  const mod = await import('qz-tray');
  return mod.default ?? mod;
}

/**
 * Print via QZ Tray to the named OS printer (must match Windows/macOS name exactly).
 */
export async function printOrderSlipViaQz(input: OrderSlipInput, printerName: string): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('QZ print is browser-only');
  }
  const qz: Qz = await loadQz();
  if (!qz.websocket.isActive()) {
    await qz.websocket.connect();
  }

  if (useQzRawEscPos()) {
    const bytes = buildOrderSlipEscPosUint8Array(input);
    const config = qz.configs.create(printerName);
    await qz.print(config, [uint8ArrayToBinaryString(bytes)]);
    return;
  }

  const html = buildOrderSlipHtmlDocument(input, { autoPrintScript: false });
  const config = qz.configs.create(printerName, {
    units: 'mm',
    margins: 2,
    scaleContent: true,
  });
  const data = [
    {
      type: 'pixel',
      format: 'html',
      flavor: 'plain',
      data: html,
    },
  ];
  await qz.print(config, data);
}

/**
 * If `NEXT_PUBLIC_QZ_TRAY_PRINTER_NAME` is set, try QZ first (no browser print dialog when working).
 * Otherwise, or on error, uses standard `printOrderSlip` (window.open + `window.print()`).
 */
export async function printOrderSlipWithQzFallback(input: OrderSlipInput): Promise<void> {
  const name = getPrinterNameFromEnv();
  if (!name) {
    printOrderSlip(input);
    return;
  }
  try {
    await printOrderSlipViaQz(input, name);
  } catch (e) {
    console.warn('[QZ Tray] print failed, using browser print dialog', e);
    printOrderSlip(input);
  }
}
