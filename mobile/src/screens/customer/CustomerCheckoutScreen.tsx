import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Alert, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { useCartStore } from '@store/cart';
import { useAuthStore } from '@store/auth';

const DELIVERY_FEE = 150;
const SERVICE_FEE = 23.49;

type PaymentOption = 'cod' | 'xpay';

interface Address {
  id: string;
  label?: string | null;
  fullAddress: string;
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
  const [paymentOption, setPaymentOption] = useState<PaymentOption>('cod');
  const [paymentOptions, setPaymentOptions] = useState<{ stripe: boolean; xpay: boolean }>({
    stripe: false,
    xpay: false
  });

  useEffect(() => {
    if (!token) return;
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

  const canPlaceOrder =
    !!selectedAddressId && !!storeId && items.length > 0 && addresses.length > 0 && !loading;

  const placeOrder = async () => {
    if (!canPlaceOrder) {
      return;
    }
    setLoading(true);
    try {
      if (paymentOption === 'xpay' && paymentOptions.xpay) {
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

      const payload = {
        storeId,
        addressId: selectedAddressId,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantityKg,
          price: i.unitPrice
        })),
        paymentMethod: 'COD' as const
      };
      const res = await api.post<{ id: string }>('/orders', payload);
      clearCart();
      Alert.alert('Order placed', 'Your order has been placed successfully.', [
        {
          text: 'View order',
          onPress: () => navigation.navigate('CustomerHome')
        }
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
      <View style={styles.centerRoot}>
        <ActivityIndicator color="#0ea5e9" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>&lt; Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.sectionTitle}>Delivery address</Text>
        {addresses.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.text}>
              No saved address. Please add an address from the web app to place orders in the mobile
              app for now.
            </Text>
          </View>
        ) : (
          <FlatList
            data={addresses}
            keyExtractor={(a) => a.id}
            contentContainerStyle={{ gap: 8, marginBottom: 12 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setSelectedAddressId(item.id)}
                style={[
                  styles.card,
                  selectedAddressId === item.id && styles.cardSelected
                ]}
              >
                <Text style={styles.addressLabel}>{item.label || 'Address'}</Text>
                <Text style={styles.addressText}>{item.fullAddress}</Text>
              </TouchableOpacity>
            )}
          />
        )}

        <Text style={styles.sectionTitle}>Payment method</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentOption === 'cod' && styles.paymentOptionSelected
            ]}
            onPress={() => setPaymentOption('cod')}
          >
            <Text style={styles.paymentTitle}>Cash on Delivery</Text>
            <Text style={styles.paymentSub}>Pay when you receive</Text>
          </TouchableOpacity>
          {paymentOptions.xpay && (
            <TouchableOpacity
              style={[
                styles.paymentOption,
                paymentOption === 'xpay' && styles.paymentOptionSelected
              ]}
              onPress={() => setPaymentOption('xpay')}
            >
              <Text style={styles.paymentTitle}>Card / Wallet (XPay)</Text>
              <Text style={styles.paymentSub}>Secure card or mobile wallet payment</Text>
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
            <Text style={styles.summaryValue}>Rs {total().toFixed(0)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery fee</Text>
            <Text style={styles.summaryValue}>Rs {DELIVERY_FEE}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Service fee</Text>
            <Text style={styles.summaryValue}>Rs {SERVICE_FEE}</Text>
          </View>
          <View style={[styles.summaryRow, { marginTop: 6 }]}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>
              Rs {(total() + DELIVERY_FEE + SERVICE_FEE).toFixed(0)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            !canPlaceOrder && styles.primaryButtonDisabled
          ]}
          disabled={!canPlaceOrder}
          onPress={placeOrder}
        >
          {loading ? <ActivityIndicator color="#000000" /> : (
            <Text style={styles.primaryButtonText}>
              {paymentOption === 'xpay' ? 'Pay with XPay' : 'Place order (Cash on Delivery)'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  centerRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc'
  },
  header: {
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0'
  },
  back: {
    color: '#0ea5e9',
    fontSize: 14,
    fontWeight: '500'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a'
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6
  },
  card: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 12,
    marginBottom: 8,
    shadowColor: '#020617',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1
  },
  cardSelected: {
    borderWidth: 1.5,
    borderColor: '#0ea5e9'
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2
  },
  addressText: {
    fontSize: 13,
    color: '#64748b'
  },
  text: {
    fontSize: 13,
    color: '#64748b'
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0'
  },
  summaryText: {
    fontSize: 13,
    color: '#0f172a'
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748b'
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a'
  },
  summaryTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a'
  },
  summaryTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f97316'
  },
  primaryButton: {
    marginTop: 12,
    borderRadius: 999,
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    alignItems: 'center'
  },
  primaryButtonDisabled: {
    backgroundColor: '#94a3b8'
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#facc15'
  },
  paymentOption: {
    paddingVertical: 8
  },
  paymentOptionSelected: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0ea5e9',
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginHorizontal: -4
  },
  paymentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a'
  },
  paymentSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  }
});

