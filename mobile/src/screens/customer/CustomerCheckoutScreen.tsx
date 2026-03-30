import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { useCartStore } from '@store/cart';
import { useAuthStore } from '@store/auth';
import { CustomerScreenShell } from '@components/customer/CustomerScreenShell';
import { VybeButton } from '@components/ui/VybeButton';
import { tokens } from '@theme/tokens';

type OrderQuote = {
  subtotal: string;
  deliveryDistanceKm: string;
  deliveryFee: string;
  serviceFee: string;
  gstAmount: string;
  cardProcessingAmount: string;
  totalAmount: string;
};

type PaymentMode = 'cod' | 'xpay' | 'card';

interface Address {
  id: string;
  label?: string | null;
  fullAddress: string;
  isDefault?: boolean;
}

interface SavedCard {
  id: string;
  last4: string;
  brand: string;
  isDefault?: boolean;
}

export function CustomerCheckoutScreen() {
  const navigation = useNavigation<any>();
  const { items, storeId, total, clearCart } = useCartStore();
  const token = useAuthStore((s) => s.token);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cod');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [paymentOptions, setPaymentOptions] = useState<{ stripe: boolean; xpay: boolean }>({
    stripe: false,
    xpay: false
  });
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const paymentMethodForQuote = paymentMode === 'cod' ? 'COD' : 'CARD';
  const cartKey = useMemo(
    () =>
      JSON.stringify(
        items.map((i) => ({ productId: i.productId, quantity: i.quantityKg, price: i.unitPrice }))
      ),
    [items]
  );

  useEffect(() => {
    if (!token) return;
    api
      .get<SavedCard[]>('/users/me/payment-methods')
      .then((r) => {
        const list = r.data ?? [];
        setSavedCards(list);
        const def = list.find((c) => c.isDefault) ?? list[0];
        if (def) setSelectedCardId(def.id);
      })
      .catch(() => setSavedCards([]));

    api
      .get<Address[]>('/users/me/addresses')
      .then((res) => {
        const list = res.data ?? [];
        setAddresses(list);
        const def = list.find((a) => a.isDefault) ?? list[0];
        if (def) setSelectedAddressId(def.id);
      })
      .catch(() => {
        setAddresses([]);
      })
      .finally(() => setInitialLoading(false));

    api
      .get<{ stripe: boolean; xpay: boolean }>('/orders/payment-options')
      .then((r) => setPaymentOptions(r.data ?? { stripe: false, xpay: false }))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token || !storeId || !selectedAddressId || items.length === 0) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setQuoteLoading(true);
    api
      .post<OrderQuote>('/orders/quote', {
        storeId,
        addressId: selectedAddressId,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantityKg,
          price: i.unitPrice
        })),
        paymentMethod: paymentMethodForQuote
      })
      .then((r) => {
        if (!cancelled) setQuote(r.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, storeId, selectedAddressId, cartKey, paymentMethodForQuote, items.length]);

  const canPlaceOrder =
    !!selectedAddressId &&
    !!storeId &&
    items.length > 0 &&
    addresses.length > 0 &&
    !loading &&
    (paymentMode !== 'card' || !!selectedCardId);

  const placeOrder = async () => {
    if (!canPlaceOrder) {
      return;
    }
    setLoading(true);
    let orderId: string | undefined;
    try {
      if (paymentMode === 'xpay' && paymentOptions.xpay) {
        const { data } = await api.post<{ redirectUrl: string }>('/orders/prepare-xpay', {
          storeId,
          addressId: selectedAddressId,
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantityKg,
            price: i.unitPrice
          }))
        });
        clearCart();
        if (data?.redirectUrl) {
          Linking.openURL(data.redirectUrl);
        }
        return;
      }

      const baseItems = items.map((i) => ({
        productId: i.productId,
        quantity: i.quantityKg,
        price: i.unitPrice
      }));

      const payload: Record<string, unknown> = {
        storeId,
        addressId: selectedAddressId,
        items: baseItems,
        paymentMethod: paymentMode === 'card' ? 'CARD' : 'COD',
      };
      if (paymentMode === 'card' && selectedCardId) {
        payload.paymentMethodId = selectedCardId;
      }

      const res = await api.post<{ id: string }>('/orders', payload);
      orderId = res.data?.id;
      clearCart();
      Alert.alert('Order placed', 'Your order has been placed successfully.', [
        {
          text: 'View order',
          onPress: () => {
            if (orderId) {
              navigation.getParent()?.navigate('OrdersTab', {
                screen: 'CustomerOrderDetail',
                params: { id: orderId }
              });
            } else {
              navigation.getParent()?.navigate('OrdersTab', { screen: 'CustomerOrders' });
            }
          }
        },
        { text: 'OK', style: 'cancel' }
      ]);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to place order';
      Alert.alert('Error', String(msg));
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <CustomerScreenShell
        title="Checkout"
        showBack
        onBack={() => navigation.goBack()}
        bottomPadding="nav"
      >
        <View style={styles.centerRoot}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      </CustomerScreenShell>
    );
  }

  return (
    <CustomerScreenShell
      title="Checkout"
      showBack
      onBack={() => navigation.goBack()}
      bottomPadding="nav"
    >
      <View style={styles.body}>
        <Text style={styles.sectionTitle}>Delivery address</Text>
        {addresses.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.text}>
              No saved address. Add one from More → Delivery addresses, then return to checkout.
            </Text>
            <VybeButton
              title="Open addresses"
              variant="outline"
              size="md"
              style={{ marginTop: 12 }}
              onPress={() =>
                navigation.getParent()?.navigate('MoreTab', { screen: 'CustomerAddresses' })
              }
            />
          </View>
        ) : (
          <View style={{ gap: 8, marginBottom: 12 }}>
            {addresses.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => setSelectedAddressId(item.id)}
                style={[
                  styles.card,
                  selectedAddressId === item.id && styles.cardSelected
                ]}
              >
                <Text style={styles.addressLabel}>{item.label || 'Address'}</Text>
                <Text style={styles.addressText}>{item.fullAddress}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Payment method</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.paymentOption, paymentMode === 'cod' && styles.paymentOptionSelected]}
            onPress={() => setPaymentMode('cod')}
          >
            <Text style={styles.paymentTitle}>Cash on Delivery</Text>
            <Text style={styles.paymentSub}>Pay when you receive</Text>
          </TouchableOpacity>
          {savedCards.length > 0 && (
            <>
              <Text style={[styles.paymentSub, { marginTop: 12, marginBottom: 6 }]}>
                Saved card (charged as paid order)
              </Text>
              {savedCards.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.paymentOption,
                    paymentMode === 'card' && selectedCardId === c.id && styles.paymentOptionSelected,
                  ]}
                  onPress={() => {
                    setPaymentMode('card');
                    setSelectedCardId(c.id);
                  }}
                >
                  <Text style={styles.paymentTitle}>
                    {c.brand} •••• {c.last4}
                    {c.isDefault ? '  (default)' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}
          {paymentOptions.stripe && savedCards.length === 0 && (
            <Text style={[styles.paymentSub, { marginTop: 8 }]}>
              Add a card under More → Payment methods (test cards supported on backend).
            </Text>
          )}
          {paymentOptions.xpay && (
            <TouchableOpacity
              style={[styles.paymentOption, paymentMode === 'xpay' && styles.paymentOptionSelected]}
              onPress={() => setPaymentMode('xpay')}
            >
              <Text style={styles.paymentTitle}>Card / Wallet (XPay)</Text>
              <Text style={styles.paymentSub}>Opens payment page in your browser</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Order summary</Text>
        <View style={styles.card}>
          {items.map((i) => (
            <View key={i.productId} style={styles.summaryRow}>
              <Text style={styles.summaryText}>
                {i.name} × {i.quantityKg} kg
              </Text>
              <Text style={styles.summaryValue}>
                Rs {(i.unitPrice * i.quantityKg).toFixed(0)}
              </Text>
            </View>
          ))}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>
              Rs {quote ? Number(quote.subtotal).toFixed(0) : total().toFixed(0)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery fee</Text>
            <Text style={styles.summaryValue}>
              {quoteLoading ? '…' : quote ? `Rs ${Number(quote.deliveryFee).toFixed(0)}` : '—'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Service fee</Text>
            <Text style={styles.summaryValue}>
              {quoteLoading ? '…' : quote ? `Rs ${Number(quote.serviceFee).toFixed(2)}` : '—'}
            </Text>
          </View>
          {quote && Number(quote.gstAmount) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>GST (COD)</Text>
              <Text style={styles.summaryValue}>Rs {Number(quote.gstAmount).toFixed(2)}</Text>
            </View>
          )}
          {quote && Number(quote.cardProcessingAmount) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Card processing</Text>
              <Text style={styles.summaryValue}>
                Rs {Number(quote.cardProcessingAmount).toFixed(2)}
              </Text>
            </View>
          )}
          <View style={[styles.summaryRow, { marginTop: 6 }]}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>
              {quoteLoading
                ? '…'
                : quote
                  ? `Rs ${Number(quote.totalAmount).toFixed(0)}`
                  : `Rs ${total().toFixed(0)}`}
            </Text>
          </View>
        </View>

        <VybeButton
          title={
            paymentMode === 'xpay'
              ? 'Pay with XPay'
              : paymentMode === 'card'
                ? 'Pay with saved card'
                : 'Place order (Cash on Delivery)'
          }
          variant="accent"
          size="lg"
          fullWidth
          loading={loading}
          disabled={!canPlaceOrder}
          onPress={placeOrder}
          style={{ marginTop: 12 }}
        />
      </View>
    </CustomerScreenShell>
  );
}

const styles = StyleSheet.create({
  centerRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 48
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.slate800,
    marginBottom: 6
  },
  card: {
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 12,
    marginBottom: 8,
    ...tokens.shadowSoft
  },
  cardSelected: {
    borderWidth: 1.5,
    borderColor: tokens.accent
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.slate800,
    marginBottom: 2
  },
  addressText: {
    fontSize: 13,
    color: tokens.slate500
  },
  text: {
    fontSize: 13,
    color: tokens.slate500
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.slate200
  },
  summaryText: {
    fontSize: 13,
    color: tokens.slate800
  },
  summaryLabel: {
    fontSize: 13,
    color: tokens.slate500
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.slate800
  },
  summaryTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.slate800
  },
  summaryTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.accent
  },
  paymentOption: {
    paddingVertical: 8
  },
  paymentOptionSelected: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.accent,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginHorizontal: -4
  },
  paymentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.slate800
  },
  paymentSub: {
    fontSize: 12,
    color: tokens.slate500,
    marginTop: 2
  }
});

