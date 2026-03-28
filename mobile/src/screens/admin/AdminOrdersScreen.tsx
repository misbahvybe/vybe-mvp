import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AdminOrdersStackParamList } from '@navigation/AdminTabs';
import { api } from '@api/client';
import { PartnerScreenShell } from '@components/partner/PartnerScreenShell';
import { VybeButton } from '@components/ui/VybeButton';
import { tokens } from '@theme/tokens';

interface Order {
  id: string;
  orderStatus: string;
  createdAt: string;
  totalAmount: number;
  store?: { name: string };
  customer?: { name: string };
  rider?: { name: string; phone: string } | null;
}

interface Rider {
  id: string;
  name: string;
  phone: string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  STORE_ACCEPTED: 'Preparing',
  STORE_REJECTED: 'Rejected',
  READY_FOR_PICKUP: 'Ready',
  RIDER_ASSIGNED: 'Rider assigned',
  RIDER_ACCEPTED: 'Accepted',
  PICKED_UP: 'Picked up',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

const OUT_FOR_DELIVERY = ['RIDER_ASSIGNED', 'RIDER_ACCEPTED', 'PICKED_UP'];

const FILTER_CHIPS: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'out_for_delivery', label: 'Out for delivery' },
  ...Object.keys(STATUS_LABELS).map((k) => ({ key: k, label: STATUS_LABELS[k] })),
];

type Nav = NativeStackNavigationProp<AdminOrdersStackParamList>;

export function AdminOrdersScreen() {
  const navigation = useNavigation<Nav>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [reassignOrder, setReassignOrder] = useState<Order | null>(null);
  const [reassignReason, setReassignReason] = useState('');
  const [reassigning, setReassigning] = useState(false);

  const fetchOrders = useCallback(() => {
    api
      .get<Order[]>('/orders')
      .then((r) => setOrders(r.data ?? []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchOrders();
    api
      .get<Rider[]>('/orders/riders/list')
      .then((r) => setRiders(r.data ?? []))
      .catch(() => setRiders([]));
  }, [fetchOrders]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (!statusFilter) return true;
      if (statusFilter === 'out_for_delivery') return OUT_FOR_DELIVERY.includes(o.orderStatus);
      return o.orderStatus === statusFilter;
    });
  }, [orders, statusFilter]);

  const canReassignList = (o: Order) =>
    o.orderStatus !== 'DELIVERED' && o.orderStatus !== 'CANCELLED';

  const pickRider = async (riderId: string) => {
    if (!reassignOrder) return;
    setReassigning(true);
    try {
      await api.patch(`/orders/${reassignOrder.id}/reassign-rider`, {
        riderId,
        reason: reassignReason.trim() || undefined,
      });
      setReassignOrder(null);
      setReassignReason('');
      fetchOrders();
    } catch (e: any) {
      Alert.alert('Error', String(e?.response?.data?.message ?? 'Failed to reassign'));
    } finally {
      setReassigning(false);
    }
  };

  return (
    <PartnerScreenShell title="Orders" scrollable={false} bottomPadding="nav">
      <View style={styles.body}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {FILTER_CHIPS.map((c) => {
            const on = statusFilter === c.key;
            return (
              <TouchableOpacity
                key={c.key || 'all'}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => setStatusFilter(c.key)}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.accent} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(o) => o.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 10 }}
            ListEmptyComponent={<Text style={styles.empty}>No orders.</Text>}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('AdminOrderDetail', { id: item.id })}
                >
                  <Text style={styles.mono}>#{item.id.slice(-8)}</Text>
                  <Text style={styles.store}>{item.store?.name ?? '—'}</Text>
                  <Text style={styles.customer}>{item.customer?.name ?? ''}</Text>
                  <View style={styles.row}>
                    <Text style={styles.status}>{item.orderStatus}</Text>
                    <Text style={styles.amount}>Rs {Number(item.totalAmount).toFixed(0)}</Text>
                  </View>
                  <Text style={styles.date}>
                    {new Date(item.createdAt).toLocaleString('en-GB', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </Text>
                  <Text style={styles.tapHint}>Tap for details</Text>
                </TouchableOpacity>
                <View style={styles.riderRow}>
                  <Text style={styles.rider}>Rider: {item.rider?.name ?? '—'}</Text>
                  {riders.length > 0 && canReassignList(item) ? (
                    <TouchableOpacity
                      onPress={() => {
                        setReassignReason('');
                        setReassignOrder(item);
                      }}
                    >
                      <Text style={styles.changeLink}>Change</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            )}
          />
        )}
      </View>

      <Modal visible={!!reassignOrder} transparent animationType="slide" onRequestClose={() => setReassignOrder(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Reassign rider
              {reassignOrder ? ` (#${reassignOrder.id.slice(-8)})` : ''}
            </Text>
            {riders.length === 0 ? (
              <Text style={styles.muted}>No active riders available.</Text>
            ) : (
              <>
                <Text style={styles.muted}>Reason (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={reassignReason}
                  onChangeText={setReassignReason}
                  placeholder="Reason"
                />
                <FlatList
                  data={riders}
                  keyExtractor={(r) => r.id}
                  style={{ maxHeight: 280 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.riderPick}
                      disabled={reassigning}
                      onPress={() => pickRider(item.id)}
                    >
                      <Text style={styles.riderPickName}>{item.name}</Text>
                      <Text style={styles.mutedSmall}>{item.phone}</Text>
                    </TouchableOpacity>
                  )}
                />
              </>
            )}
            <VybeButton title="Close" variant="outline" onPress={() => setReassignOrder(null)} />
          </View>
        </View>
      </Modal>
    </PartnerScreenShell>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  chipsRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: tokens.slate100,
    marginRight: 4,
  },
  chipOn: {
    backgroundColor: tokens.primaryDark,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: tokens.slate600 },
  chipTextOn: { color: tokens.white },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', color: tokens.slate500, marginTop: 32 },
  card: {
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 12,
    ...tokens.shadowSoft,
  },
  mono: { fontSize: 11, fontFamily: 'monospace', color: tokens.slate500 },
  store: { fontSize: 15, fontWeight: '600', color: tokens.slate800, marginTop: 4 },
  customer: { fontSize: 13, color: tokens.slate500, marginTop: 2 },
  riderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  rider: { fontSize: 12, color: tokens.slate600, flex: 1 },
  changeLink: { fontSize: 12, fontWeight: '700', color: tokens.accent },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  status: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.accent,
    textTransform: 'uppercase',
  },
  amount: { fontSize: 14, fontWeight: '700', color: tokens.slate800 },
  date: { fontSize: 11, color: tokens.slate400, marginTop: 6 },
  tapHint: { fontSize: 11, color: tokens.slate400, marginTop: 8, fontWeight: '500' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: tokens.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '88%',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: tokens.slate800, marginBottom: 10 },
  muted: { fontSize: 13, color: tokens.slate500, marginBottom: 6 },
  mutedSmall: { fontSize: 11, color: tokens.slate400, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: tokens.slate200,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    fontSize: 15,
    color: tokens.slate800,
  },
  riderPick: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.slate100,
  },
  riderPickName: { fontSize: 15, fontWeight: '600', color: tokens.slate800 },
});
