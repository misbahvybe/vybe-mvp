import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { PartnerScreenShell } from '@components/partner/PartnerScreenShell';
import { VybeButton } from '@components/ui/VybeButton';
import { tokens } from '@theme/tokens';

interface OrderDetail {
  id: string;
  orderStatus: string;
  totalAmount: number;
  paymentMethod?: string;
  store?: { name: string; address?: string; latitude?: number; longitude?: number; phone?: string };
  customer?: { name: string; phone: string };
  address?: { fullAddress: string; latitude?: number; longitude?: number };
  statusHistory?: { status: string; createdAt: string }[];
  allowedTransitions?: string[];
  items: { product: { name: string }; quantity: number; price: number }[];
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  STORE_ACCEPTED: 'Accepted by store',
  STORE_REJECTED: 'Rejected',
  READY_FOR_PICKUP: 'Ready for pickup',
  RIDER_ASSIGNED: 'Assigned to you',
  RIDER_ACCEPTED: 'Accepted',
  PICKED_UP: 'Picked up',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

function mapsUrl(lat?: number, lng?: number, address?: string): string {
  if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  if (address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  }
  return 'https://www.google.com/maps';
}

export function RiderOrderDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const id: string | undefined = route.params?.id;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrder = useCallback(() => {
    if (!id) return;
    api
      .get<OrderDetail>(`/orders/${id}`)
      .then((r) => setOrder(r.data))
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
      .then((r) => setOrder(r.data))
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
      Alert.alert('Error', String(e?.response?.data?.message ?? 'Failed'));
    } finally {
      setActionLoading(false);
    }
  };

  if (!id) {
    return (
      <PartnerScreenShell title="Order" showBack onBack={() => navigation.goBack()} bottomPadding="nav">
        <View style={styles.center}>
          <Text style={styles.muted}>Missing order.</Text>
        </View>
      </PartnerScreenShell>
    );
  }

  if (loading || !order) {
    return (
      <PartnerScreenShell title="Order" showBack onBack={() => navigation.goBack()} bottomPadding="nav">
        <View style={styles.center}>
          {loading ? <ActivityIndicator color={tokens.accent} /> : <Text style={styles.muted}>Not found.</Text>}
        </View>
      </PartnerScreenShell>
    );
  }

  const allowed = order.allowedTransitions ?? [];
  const formatDate = (d: string) =>
    new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <PartnerScreenShell
      title={`Order #${order.id.slice(-8)}`}
      showBack
      onBack={() => navigation.goBack()}
      bottomPadding="nav"
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {order.statusHistory && order.statusHistory.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.section}>Timeline</Text>
            {order.statusHistory.map((h, idx) => (
              <View key={idx} style={styles.timelineRow}>
                <Text style={styles.dot}>{h.status === 'CANCELLED' || h.status === 'STORE_REJECTED' ? '✕' : '✔'}</Text>
                <View>
                  <Text style={styles.timelineTitle}>{STATUS_LABELS[h.status] ?? h.status}</Text>
                  <Text style={styles.mutedSmall}>{formatDate(h.createdAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.section}>Store</Text>
          <Text style={styles.bold}>{order.store?.name ?? 'Store'}</Text>
          <Text style={styles.body}>{order.store?.address ?? '—'}</Text>
          {order.store?.phone ? (
            <TouchableOpacity
              onPress={() => {
                const p = order.store?.phone;
                if (p) void Linking.openURL(`tel:${p}`);
              }}
            >
              <Text style={styles.link}>Call store</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() =>
              Linking.openURL(
                mapsUrl(order.store?.latitude, order.store?.longitude, order.store?.address),
              )
            }
          >
            <Text style={[styles.link, { marginTop: 6 }]}>Open store in Maps</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Customer</Text>
          <Text style={styles.bold}>{order.customer?.name ?? 'Customer'}</Text>
          <Text style={styles.body}>{order.address?.fullAddress ?? '—'}</Text>
          {order.customer?.phone ? (
            <TouchableOpacity
              onPress={() => {
                const p = order.customer?.phone;
                if (p) void Linking.openURL(`tel:${p}`);
              }}
            >
              <Text style={styles.link}>Call customer</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() =>
              Linking.openURL(
                mapsUrl(order.address?.latitude, order.address?.longitude, order.address?.fullAddress),
              )
            }
          >
            <Text style={[styles.link, { marginTop: 6 }]}>Open drop-off in Maps</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Items</Text>
          {order.items.map((i, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.body}>
                {i.product.name} × {Number(i.quantity)}
              </Text>
              <Text style={styles.itemAmt}>Rs {(Number(i.quantity) * Number(i.price)).toFixed(0)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          {order.paymentMethod === 'COD' ? (
            <Text style={styles.collect}>
              Collect: Rs {Number(order.totalAmount).toLocaleString()} PKR (COD)
            </Text>
          ) : (
            <Text style={styles.paid}>Paid online — no collection</Text>
          )}
        </View>

        {allowed.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.section}>Actions</Text>
            {allowed.includes('RIDER_ACCEPTED') && (
              <View style={{ gap: 8 }}>
                <VybeButton
                  title="Accept order"
                  variant="accent"
                  loading={actionLoading}
                  disabled={actionLoading}
                  onPress={() => updateStatus('RIDER_ACCEPTED')}
                />
                <VybeButton
                  title="Decline (return to ready)"
                  variant="outline"
                  disabled={actionLoading}
                  onPress={() => {
                    Alert.alert('Decline?', 'Send this order back to ready for pickup?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Confirm', onPress: () => updateStatus('READY_FOR_PICKUP') },
                    ]);
                  }}
                />
              </View>
            )}
            {allowed.includes('PICKED_UP') && (
              <VybeButton
                title="Mark picked up"
                variant="accent"
                loading={actionLoading}
                disabled={actionLoading}
                onPress={() => updateStatus('PICKED_UP')}
                style={{ marginTop: 8 }}
              />
            )}
            {allowed.includes('DELIVERED') && (
              <VybeButton
                title="Mark delivered"
                variant="accent"
                loading={actionLoading}
                disabled={actionLoading}
                onPress={() => updateStatus('DELIVERED')}
                style={{ marginTop: 8 }}
              />
            )}
          </View>
        )}
      </ScrollView>
    </PartnerScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  muted: { color: tokens.slate500 },
  mutedSmall: { fontSize: 11, color: tokens.slate400, marginTop: 2 },
  card: {
    backgroundColor: tokens.surface,
    borderRadius: tokens.radiusCard,
    padding: 14,
    marginBottom: 12,
    ...tokens.shadowSoft,
  },
  section: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.slate500,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  bold: { fontSize: 15, fontWeight: '700', color: tokens.slate800 },
  body: { fontSize: 13, color: tokens.slate600, marginTop: 4, lineHeight: 18 },
  link: { fontSize: 14, fontWeight: '600', color: tokens.accent, marginTop: 8 },
  timelineRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tokens.primaryDark,
    color: tokens.white,
    textAlign: 'center',
    lineHeight: 28,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '700',
  },
  timelineTitle: { fontSize: 14, fontWeight: '600', color: tokens.slate800 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  itemAmt: { fontWeight: '600', color: tokens.accent },
  collect: { fontSize: 16, fontWeight: '800', color: tokens.accent },
  paid: { fontSize: 14, fontWeight: '600', color: '#15803d' },
});
