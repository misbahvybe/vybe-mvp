import { Platform } from 'react-native';
import { formatOrderNo } from './orderDisplay';

export type OrderForSunmiPrint = {
  id: string;
  orderNumber?: number;
  createdAt: string;
  paymentMethod?: string;
  totalAmount: number;
  store?: { name?: string; phone?: string; address?: string };
  customer?: { name?: string; phone?: string };
  address?: { fullAddress?: string; city?: string };
  items: { product?: { name?: string }; quantity: number; price: number }[];
  deliveryFee?: number;
  serviceFee?: number;
  gstAmount?: number;
  cardProcessingAmount?: number;
};

function n(v: unknown): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function money(v: unknown): string {
  return n(v).toFixed(0);
}

/** ~32 chars fits Sunmi 58mm at default small font. */
function wrapLine(text: string, max = 32): string[] {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return [''];
  const out: string[] = [];
  let rest = t;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(' ', max);
    if (cut < max * 0.5) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

function getSunmiPrinterModule(): {
  initPrinter: () => Promise<null>;
  setAlignment: (a: number) => Promise<null>;
  setFontSize: (n: number) => Promise<null>;
  printText: (s: string) => Promise<null>;
  printTextWithOption: (s: string, fontSize: number, bold: boolean, underline: boolean) => Promise<null>;
  printLineWrap: (n: number) => Promise<null>;
  feedPaper: () => Promise<null>;
} | null {
  if (Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@hendrysetiadi/react-native-sunmi-printer');
    return mod?.default ?? mod;
  } catch {
    return null;
  }
}

export function isSunmiPrinterAvailable(): boolean {
  return getSunmiPrinterModule() != null;
}

/**
 * Prints a 58mm-friendly ticket on SUNMI inner printer (V2 / V2 PRO).
 * Requires a native Android build (EAS / expo prebuild); Expo Go will fail at runtime.
 */
export async function printOrderTicketSunmi(order: OrderForSunmiPrint): Promise<void> {
  const Sunmi = getSunmiPrinterModule();
  if (!Sunmi) {
    throw new Error('Sunmi printer module is not available on this build.');
  }

  await Sunmi.initPrinter();

  /** One size for whole ticket (match TOTAL line weight). */
  const SZ = 36;
  const wrap = 18;

  const storeName = order.store?.name?.trim() || 'Vybe Store';
  await Sunmi.setAlignment(1);
  await Sunmi.printTextWithOption('VYBE SUPER APP\n', SZ, true, false);
  await Sunmi.printTextWithOption(`${storeName}\n`, SZ, true, false);
  await Sunmi.setFontSize(SZ);
  if (order.store?.address) {
    for (const line of wrapLine(order.store.address, wrap)) {
      await Sunmi.printTextWithOption(`${line}\n`, SZ, true, false);
    }
  }
  if (order.store?.phone) {
    await Sunmi.printTextWithOption(`${order.store.phone}\n`, SZ, true, false);
  }

  await Sunmi.setAlignment(0);
  await Sunmi.printText('--------------------------------\n');

  await Sunmi.printTextWithOption(`Order ${formatOrderNo(order.orderNumber, order.id)}\n`, SZ, true, false);
  await Sunmi.printTextWithOption(`${new Date(order.createdAt).toLocaleString('en-PK')}\n`, SZ, true, false);
  const pay = order.paymentMethod === 'COD' ? 'COD' : 'PAID';
  await Sunmi.printTextWithOption(`Payment: ${pay}\n`, SZ, true, false);

  if (order.customer?.name || order.customer?.phone) {
    await Sunmi.printTextWithOption(
      `Customer: ${[order.customer?.name, order.customer?.phone].filter(Boolean).join(' · ')}\n`,
      SZ,
      true,
      false,
    );
  }

  await Sunmi.printText('--------------------------------\n');
  await Sunmi.setAlignment(0);
  await Sunmi.printTextWithOption('ITEMS\n', SZ, true, false);
  await Sunmi.setFontSize(SZ);

  let itemsSum = 0;
  for (const it of order.items ?? []) {
    const qty = n(it.quantity);
    const price = n(it.price);
    const lineAmt = qty * price;
    itemsSum += lineAmt;
    const name = it.product?.name?.trim() || 'Item';
    for (const line of wrapLine(`${name}`, wrap)) {
      await Sunmi.printTextWithOption(`${line}\n`, SZ, true, false);
    }
    await Sunmi.printTextWithOption(`  ${qty} x Rs ${money(price)} = Rs ${money(lineAmt)}\n`, SZ, true, false);
  }

  await Sunmi.printText('--------------------------------\n');
  await Sunmi.printTextWithOption(`Items     Rs ${money(itemsSum)}\n`, SZ, true, false);
  if (n(order.deliveryFee) > 0) {
    await Sunmi.printTextWithOption(`Delivery  Rs ${money(order.deliveryFee)}\n`, SZ, true, false);
  }
  if (n(order.serviceFee) > 0) {
    await Sunmi.printTextWithOption(`Service   Rs ${money(order.serviceFee)}\n`, SZ, true, false);
  }
  if (n(order.gstAmount) > 0) await Sunmi.printTextWithOption(`Tax       Rs ${money(order.gstAmount)}\n`, SZ, true, false);
  if (n(order.cardProcessingAmount) > 0) {
    await Sunmi.printTextWithOption(`Card fee  Rs ${money(order.cardProcessingAmount)}\n`, SZ, true, false);
  }

  await Sunmi.setAlignment(1);
  await Sunmi.printTextWithOption(`TOTAL\nRs ${money(order.totalAmount)}\n`, SZ, true, false);
  await Sunmi.setAlignment(0);

  if (order.address?.fullAddress) {
    await Sunmi.printText('--------------------------------\n');
    await Sunmi.printTextWithOption('DELIVERY\n', SZ, true, false);
    for (const line of wrapLine(order.address.fullAddress, wrap)) {
      await Sunmi.printTextWithOption(`${line}\n`, SZ, true, false);
    }
  }

  await Sunmi.printText('--------------------------------\n');
  await Sunmi.setAlignment(1);
  await Sunmi.printTextWithOption('Thank you — Vybe\n', SZ, true, false);
  await Sunmi.printLineWrap(2);
  await Sunmi.feedPaper();
}
