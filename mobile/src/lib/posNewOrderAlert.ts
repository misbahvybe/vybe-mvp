import { api } from '@api/client';
import { isSunmiPrinterAvailable, printOrderTicketSunmi, type OrderForSunmiPrint } from './sunmiOrderTicket';

type OrderDetailForPrint = {
  id: string;
  orderNumber?: number;
  createdAt: string;
  orderStatus: string;
  totalAmount: number;
  paymentMethod?: string;
  deliveryFee?: number;
  serviceFee?: number;
  gstAmount?: number;
  cardProcessingAmount?: number;
  store?: { name: string; phone?: string; address?: string };
  customer?: { name: string; phone: string };
  address?: { fullAddress: string };
  items: { product: { name: string }; quantity: number; price: number }[];
};

function mapToSunmi(d: OrderDetailForPrint): OrderForSunmiPrint {
  return {
    id: d.id,
    orderNumber: d.orderNumber,
    createdAt: d.createdAt,
    paymentMethod: d.paymentMethod,
    totalAmount: Number(d.totalAmount),
    store: d.store,
    customer: d.customer,
    address: d.address,
    items: d.items.map((i) => ({
      product: i.product,
      quantity: Number(i.quantity),
      price: Number(i.price),
    })),
    deliveryFee: d.deliveryFee != null ? Number(d.deliveryFee) : undefined,
    serviceFee: d.serviceFee != null ? Number(d.serviceFee) : undefined,
    gstAmount: d.gstAmount != null ? Number(d.gstAmount) : undefined,
    cardProcessingAmount: d.cardProcessingAmount != null ? Number(d.cardProcessingAmount) : undefined,
  };
}

/**
 * Fetches full order and prints on Sunmi inner printer if the native module is available.
 * No-op on iOS, Expo Go, or non-Sunmi devices.
 */
export async function fetchAndPrintOrderIfSunmi(orderId: string): Promise<void> {
  if (!isSunmiPrinterAvailable()) return;
  const res = await api.get<OrderDetailForPrint>(`/orders/${orderId}`);
  const o = res.data;
  if (!o || o.orderStatus === 'CANCELLED' || o.orderStatus === 'STORE_REJECTED') return;
  await printOrderTicketSunmi(mapToSunmi(o));
}
