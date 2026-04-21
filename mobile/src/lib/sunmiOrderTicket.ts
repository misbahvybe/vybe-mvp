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

  const storeName = order.store?.name?.trim() || 'VYBE';
  await Sunmi.setAlignment(1);
  await Sunmi.printTextWithOption(storeName, 28, true, false);
  await Sunmi.setFontSize(22);
  if (order.store?.address) {
    for (const line of wrapLine(order.store.address, 28)) {
      await Sunmi.printText(`${line}\n`);
    }
  }
  if (order.store?.phone) {
    await Sunmi.printText(`${order.store.phone}\n`);
  }

  await Sunmi.setAlignment(0);
  await Sunmi.printText('--------------------------------\n');

  await Sunmi.printText(`Order  ${formatOrderNo(order.orderNumber, order.id)}\n`);
  await Sunmi.printText(`${new Date(order.createdAt).toLocaleString()}\n`);
  const pay = order.paymentMethod === 'COD' ? 'COD' : 'PAID';
  await Sunmi.printText(`Payment: ${pay}\n`);

  if (order.customer?.name || order.customer?.phone) {
    await Sunmi.printText(
      `Customer: ${[order.customer?.name, order.customer?.phone].filter(Boolean).join(' · ')}\n`,
    );
  }

  await Sunmi.printText('--------------------------------\n');
  await Sunmi.setAlignment(0);
  await Sunmi.printTextWithOption('ITEMS\n', 24, true, false);
  await Sunmi.setFontSize(22);

  let itemsSum = 0;
  for (const it of order.items ?? []) {
    const qty = n(it.quantity);
    const price = n(it.price);
    const lineAmt = qty * price;
    itemsSum += lineAmt;
    const name = it.product?.name?.trim() || 'Item';
    for (const line of wrapLine(`${name}`, 28)) {
      await Sunmi.printText(`${line}\n`);
    }
    await Sunmi.printText(`  ${qty} x Rs ${money(price)} = Rs ${money(lineAmt)}\n`);
  }

  await Sunmi.printText('--------------------------------\n');
  await Sunmi.printText(`Items     Rs ${money(itemsSum)}\n`);
  if (n(order.deliveryFee) > 0) await Sunmi.printText(`Delivery  Rs ${money(order.deliveryFee)}\n`);
  if (n(order.serviceFee) > 0) await Sunmi.printText(`Service   Rs ${money(order.serviceFee)}\n`);
  if (n(order.gstAmount) > 0) await Sunmi.printText(`Tax       Rs ${money(order.gstAmount)}\n`);
  if (n(order.cardProcessingAmount) > 0) {
    await Sunmi.printText(`Card fee  Rs ${money(order.cardProcessingAmount)}\n`);
  }

  await Sunmi.setAlignment(1);
  await Sunmi.printTextWithOption(`TOTAL  Rs ${money(order.totalAmount)}\n`, 28, true, false);
  await Sunmi.setAlignment(0);

  if (order.address?.fullAddress) {
    await Sunmi.printText('--------------------------------\n');
    await Sunmi.printTextWithOption('DELIVERY\n', 24, true, false);
    for (const line of wrapLine(order.address.fullAddress, 28)) {
      await Sunmi.printText(`${line}\n`);
    }
  }

  await Sunmi.printText('--------------------------------\n');
  await Sunmi.setAlignment(1);
  await Sunmi.printText('Thank you — Vybe\n');
  await Sunmi.printLineWrap(2);
  await Sunmi.feedPaper();
}
