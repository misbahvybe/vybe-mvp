import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { CustomerScreenShell } from '@components/customer/CustomerScreenShell';
import { VybeButton } from '@components/ui/VybeButton';
import { tokens } from '@theme/tokens';
import { formatOrderNo } from '@lib/orderDisplay';

interface OrderItem {
  id: string;
  product: { name: string };
  quantity: number;
  price: number;
}

interface OrderDetail {
  id: string;
  orderNumber?: number;
  orderStatus: string;
  cancellationReason?: string | null;
  createdAt: string;
  totalAmount: number;
  store?: { name: string };
  address?: { fullAddress: string };
  rider?: { name: string; phone: string } | null;
  statusHistory?: { status: string; createdAt: string; changedByUserId: string | null }[];
  allowedTransitions?: string[];
  items: OrderItem[];
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  STORE_ACCEPTED: 'Accepted by store',
  STORE_REJECTED: 'Rejected by store',
  READY_FOR_PICKUP: 'Ready for pickup',
  RIDER_ASSIGNED: 'Captain assigned',
  RIDER_ACCEPTED: 'Captain accepted',
  PICKED_UP: 'Picked up',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export function CustomerOrderDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const id: string = route.params?.id;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrder = useCallback(() => {
    if (!id) return;
    api
      .get<OrderDetail>(`/orders/${id}`)
      .then((res) => setOrder(res.data))
      .catch(() => setOrder(null));
  }, [id]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .get<OrderDetail>(`/orders/${id}`)
      .then((res) => setOrder(res.data))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (status: string) => {
    if (!order) return;
    setActionLoading(true);
    try {
      await api.patch(`/orders/${order.id}/status`, { status });
      fetchOrder();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to update order';
      Alert.alert('Error', String(msg));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <CustomerScreenShell
        title="Order"
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

  if (!order) {
    return (
      <CustomerScreenShell
        title="Order"
        showBack
        onBack={() => navigation.goBack()}
        bottomPadding="nav"
      >
        <View style={styles.centerRoot}>
          <Text style={styles.empty}>Order not found.</Text>
        </View>
      </CustomerScreenShell>
    );
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  const allowed = order.allowedTransitions ?? [];

  return (
    <CustomerScreenShell
      title="Order details"
      showBack
      onBack={() => navigation.goBack()}
      bottomPadding="nav"
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.muted}>Order {formatOrderNo(order.orderNumber, order.id)}</Text>
          <Text style={styles.title}>{order.store?.name ?? 'Order'}</Text>
          <Text style={styles.muted}>{formatDate(order.createdAt)}</Text>
          <Text style={styles.status}>{STATUS_LABELS[order.orderStatus] ?? order.orderStatus}</Text>
          {order.cancellationReason ? (
            <Text style={styles.cancelNote}>Reason: {order.cancellationReason}</Text>
          ) : null}
        </View>

        {allowed.includes('CANCELLED') && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <VybeButton
              title="Cancel order"
              variant="outline"
              loading={actionLoading}
              disabled={actionLoading}
              onPress={() => {
                Alert.alert('Cancel order', 'Are you sure you want to cancel this order?', [
                  { text: 'No', style: 'cancel' },
                  {
                    text: 'Yes, cancel',
                    style: 'destructive',
                    onPress: () => updateStatus('CANCELLED'),
                  },
                ]);
              }}
            />
          </View>
        )}

        {order.address && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Delivery address</Text>
            <Text style={styles.bodyText}>{order.address.fullAddress}</Text>
          </View>
        )}

        {order.rider && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Captain</Text>
            <Text style={styles.bodyText}>
              {order.rider.name} — {order.rider.phone}
            </Text>
          </View>
        )}

        {order.statusHistory && order.statusHistory.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Order progress</Text>
            {order.statusHistory.map((h, idx) => (
              <View key={`${h.status}-${idx}`} style={styles.historyRow}>
                <Text style={styles.historyDot}>•</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTitle}>{STATUS_LABELS[h.status] ?? h.status}</Text>
                  <Text style={styles.mutedSmall}>{formatDate(h.createdAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Products</Text>
          {order.items.map((item) => {
            const lineTotal = Number(item.quantity) * Number(item.price);
            return (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemText}>
                  {item.product.name} × {Number(item.quantity)}
                </Text>
                <Text style={styles.itemAmount}>Rs {lineTotal.toFixed(0)}</Text>
              </View>
            );
          })}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>Rs {Number(order.totalAmount).toFixed(0)}</Text>
          </View>
        </View>
      </ScrollView>
    </CustomerScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: 8, paddingBottom: 32 },
  centerRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 48,
  },
  empty: { fontSize: 14, color: tokens.slate500 },
  card: {
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 16,
    ...tokens.shadowSoft,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  title: { fontSize: 16, fontWeight: '700', color: tokens.slate800, marginTop: 4 },
  muted: { fontSize: 13, color: tokens.slate400 },
  mutedSmall: { fontSize: 11, color: tokens.slate400, marginTop: 2 },
  status: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: tokens.slate200,
    fontSize: 12,
    fontWeight: '500',
    color: tokens.slate800,
  },
  cancelNote: { marginTop: 8, fontSize: 13, color: '#b91c1c' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: tokens.slate800, marginBottom: 8 },
  bodyText: { fontSize: 13, color: tokens.slate600, lineHeight: 18 },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.slate200,
  },
  itemText: { fontSize: 13, color: tokens.slate800 },
  itemAmount: { fontSize: 13, fontWeight: '600', color: tokens.accent },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  totalLabel: { fontSize: 14, fontWeight: '700', color: tokens.slate800 },
  totalValue: { fontSize: 16, fontWeight: '700', color: tokens.accent },
  historyRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  historyDot: { fontSize: 20, color: tokens.accent, lineHeight: 22 },
  historyTitle: { fontSize: 13, fontWeight: '600', color: tokens.slate800 },
});
