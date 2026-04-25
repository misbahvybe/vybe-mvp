import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { printOrderTicketSunmi } from '@lib/sunmiOrderTicket';
import { useRoute, useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { PartnerScreenShell } from '@components/partner/PartnerScreenShell';
import { VybeButton } from '@components/ui/VybeButton';
import { tokens } from '@theme/tokens';
import { useAuthStore } from '@store/auth';
import { formatOrderNo } from '@lib/orderDisplay';

interface OrderItemRow {
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
  paymentMethod?: string;
  deliveryFee?: number;
  serviceFee?: number;
  gstAmount?: number;
  cardProcessingAmount?: number;
  store?: { name: string; phone?: string; address?: string };
  customer?: { name: string; phone: string };
  address?: { fullAddress: string };
  rider?: { name: string; phone: string } | null;
  statusHistory?: { status: string; createdAt: string; changedByUserId: string | null }[];
  allowedTransitions?: string[];
  items: OrderItemRow[];
}

interface Rider {
  id: string;
  name: string;
  phone: string;
}

const CANCELLATION_LABELS: Record<string, string> = {
  CUSTOMER_CANCELLED: 'Customer cancelled',
  STORE_REJECTED: 'Store rejected',
  ADMIN_CANCELLED: 'Admin cancelled',
  OUT_OF_STOCK: 'Out of stock',
  STORE_CLOSED: 'Store closed',
  OTHER: 'Other',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  STORE_ACCEPTED: 'Accepted by store',
  STORE_REJECTED: 'Rejected by store',
  READY_FOR_PICKUP: 'Ready for pickup',
  RIDER_ASSIGNED: 'Rider assigned',
  RIDER_ACCEPTED: 'Rider accepted',
  PICKED_UP: 'Picked up',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export function PartnerOrderDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;

  const id: string | undefined = route.params?.id;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [riders, setRiders] = useState<Rider[]>([]);

  const [qtyModal, setQtyModal] = useState<{ itemId: string; name: string; current: number } | null>(null);
  const [qtyInput, setQtyInput] = useState('');

  const [riderModal, setRiderModal] = useState<'assign' | 'reassign' | null>(null);
  const [reassignReason, setReassignReason] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [printing, setPrinting] = useState(false);

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

  useEffect(() => {
    if (role === 'ADMIN') {
      api
        .get<Rider[]>('/orders/riders/list')
        .then((r) => setRiders(r.data ?? []))
        .catch(() => setRiders([]));
    }
  }, [role]);

  const updateStatus = async (status: string, extra?: { riderId?: string; cancellationReason?: string }) => {
    if (!order) return;
    setActionLoading(true);
    try {
      await api.patch(`/orders/${order.id}/status`, { status, ...extra });
      fetchOrder();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to update status';
      Alert.alert('Error', String(msg));
    } finally {
      setActionLoading(false);
    }
  };

  const patchItemQty = async (itemId: string, quantity: number) => {
    if (!order) return;
    try {
      await api.patch(`/orders/${order.id}/items/${itemId}`, { quantity });
      setQtyModal(null);
      fetchOrder();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to update item';
      Alert.alert('Error', String(msg));
    }
  };

  const patchItemRemove = (itemId: string, productName: string) => {
    if (!order) return;
    Alert.alert(
      'Remove item',
      `Remove ${productName} from this order? The total will be reduced.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.patch(`/orders/${order.id}/items/${itemId}`, { remove: true });
              fetchOrder();
            } catch (e: any) {
              const msg = e?.response?.data?.message ?? 'Failed to remove item';
              Alert.alert('Error', String(msg));
            }
          },
        },
      ],
    );
  };

  const openQtyModal = (item: OrderItemRow) => {
    const cur = Number(item.quantity);
    setQtyInput(String(Math.max(1, cur - 1)));
    setQtyModal({ itemId: item.id, name: item.product.name, current: cur });
  };

  const submitQtyModal = () => {
    if (!qtyModal || !order) return;
    const newQty = Number(qtyInput);
    const cur = qtyModal.current;
    if (!newQty || newQty <= 0 || newQty >= cur) {
      Alert.alert('Invalid quantity', 'Only reducing quantity is allowed.');
      return;
    }
    patchItemQty(qtyModal.itemId, newQty);
  };

  const printSunmiTicket = async () => {
    if (!order || Platform.OS !== 'android') return;
    setPrinting(true);
    try {
      await printOrderTicketSunmi({
        id: order.id,
        createdAt: order.createdAt,
        paymentMethod: order.paymentMethod,
        totalAmount: Number(order.totalAmount),
        store: order.store,
        customer: order.customer,
        address: order.address,
        items: order.items.map((i) => ({
          product: i.product,
          quantity: Number(i.quantity),
          price: Number(i.price),
        })),
        deliveryFee: order.deliveryFee != null ? Number(order.deliveryFee) : undefined,
        serviceFee: order.serviceFee != null ? Number(order.serviceFee) : undefined,
        gstAmount: order.gstAmount != null ? Number(order.gstAmount) : undefined,
        cardProcessingAmount:
          order.cardProcessingAmount != null ? Number(order.cardProcessingAmount) : undefined,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert(
        'Print failed',
        `${msg}\n\nIf you are on Expo Go, build a development/production APK with EAS so the Sunmi printer native module is included.`,
      );
    } finally {
      setPrinting(false);
    }
  };

  const onPickRider = async (riderId: string) => {
    if (!order) return;
    if (riderModal === 'assign') {
      setRiderModal(null);
      await updateStatus('RIDER_ASSIGNED', { riderId });
      return;
    }
    if (riderModal === 'reassign') {
      try {
        setActionLoading(true);
        await api.patch(`/orders/${order.id}/reassign-rider`, {
          riderId,
          reason: reassignReason.trim() || undefined,
        });
        setRiderModal(null);
        setReassignReason('');
        fetchOrder();
      } catch (e: any) {
        const msg = e?.response?.data?.message ?? 'Failed to reassign rider';
        Alert.alert('Error', String(msg));
      } finally {
        setActionLoading(false);
      }
    }
  };

  if (!id) {
    return (
      <PartnerScreenShell title="Order" showBack onBack={() => navigation.goBack()} bottomPadding="nav">
        <View style={styles.centerRoot}>
          <Text style={styles.empty}>Missing order id.</Text>
        </View>
      </PartnerScreenShell>
    );
  }

  if (loading) {
    return (
      <PartnerScreenShell title="Order" showBack onBack={() => navigation.goBack()} bottomPadding="nav">
        <View style={styles.centerRoot}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      </PartnerScreenShell>
    );
  }

  if (!order) {
    return (
      <PartnerScreenShell title="Order" showBack onBack={() => navigation.goBack()} bottomPadding="nav">
        <View style={styles.centerRoot}>
          <Text style={styles.empty}>Order not found or you do not have access.</Text>
        </View>
      </PartnerScreenShell>
    );
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  const allowed = order.allowedTransitions ?? [];
  const canEditItems =
    (role === 'ADMIN' || role === 'STORE_OWNER') &&
    (order.orderStatus === 'PENDING' || order.orderStatus === 'STORE_ACCEPTED');

  const adminCanReassign =
    role === 'ADMIN' &&
    order.orderStatus !== 'DELIVERED' &&
    order.orderStatus !== 'CANCELLED';

  const statusOtherButtons = ['STORE_ACCEPTED', 'STORE_REJECTED', 'READY_FOR_PICKUP', 'RIDER_ACCEPTED', 'PICKED_UP', 'DELIVERED'].filter(
    (s) => allowed.includes(s) && s !== 'RIDER_ASSIGNED' && s !== 'CANCELLED',
  );

  return (
    <PartnerScreenShell title="Order details" showBack onBack={() => navigation.goBack()} bottomPadding="nav">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.muted}>Order {formatOrderNo(order.orderNumber, order.id)}</Text>
          <Text style={styles.title}>{order.store?.name ?? 'Order'}</Text>
          <Text style={styles.muted}>{formatDate(order.createdAt)}</Text>
          <Text style={styles.status}>{STATUS_LABELS[order.orderStatus] ?? order.orderStatus}</Text>
          {role === 'STORE_OWNER' && Platform.OS === 'android' ? (
            <VybeButton
              title={printing ? 'Printing…' : 'Print receipt (Sunmi)'}
              variant="outline"
              disabled={printing}
              loading={printing}
              onPress={printSunmiTicket}
              style={styles.actionBtn}
            />
          ) : null}
          {order.cancellationReason ? (
            <Text style={styles.cancelNote}>
              Reason: {CANCELLATION_LABELS[order.cancellationReason] ?? order.cancellationReason}
            </Text>
          ) : null}
        </View>

        {allowed.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Actions</Text>
            {allowed.includes('RIDER_ASSIGNED') && role === 'ADMIN' && (
              <VybeButton
                title={riders.length ? 'Assign rider' : 'No riders available'}
                variant="primary"
                disabled={actionLoading || !riders.length}
                loading={actionLoading}
                onPress={() => setRiderModal('assign')}
                style={styles.actionBtn}
              />
            )}
            {allowed.includes('CANCELLED') && role === 'ADMIN' && (
              <VybeButton
                title="Cancel order"
                variant="outline"
                disabled={actionLoading}
                onPress={() => setCancelModalOpen(true)}
                style={styles.actionBtn}
              />
            )}
            {statusOtherButtons.map((status) => (
              <VybeButton
                key={status}
                title={STATUS_LABELS[status] ?? status}
                variant="accent"
                disabled={actionLoading}
                loading={actionLoading}
                onPress={() => updateStatus(status)}
                style={styles.actionBtn}
              />
            ))}
          </View>
        )}

        {(order.rider || (role === 'ADMIN' && adminCanReassign)) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Rider</Text>
            {order.rider ? (
              <Text style={styles.bodyText}>
                {order.rider.name} — {order.rider.phone}
              </Text>
            ) : (
              <Text style={styles.bodyText}>Not assigned</Text>
            )}
            {role === 'ADMIN' && adminCanReassign && riders.length > 0 ? (
              <VybeButton
                title="Change rider"
                variant="outline"
                disabled={actionLoading}
                onPress={() => {
                  setReassignReason('');
                  setRiderModal('reassign');
                }}
                style={styles.actionBtn}
              />
            ) : null}
          </View>
        )}

        {order.address && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Delivery address</Text>
            <Text style={styles.bodyText}>{order.address.fullAddress}</Text>
          </View>
        )}

        {order.statusHistory && order.statusHistory.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Order progress</Text>
            {order.statusHistory.map((h, idx) => {
              const isLast = idx === order.statusHistory!.length - 1;
              const bad = h.status === 'CANCELLED' || h.status === 'STORE_REJECTED';
              return (
                <View key={`${h.status}-${idx}`} style={styles.historyRow}>
                  <View style={[styles.historyDot, isLast && bad ? styles.historyDotBad : styles.historyDotOk]}>
                    <Text style={[styles.historyDotText, isLast && bad && styles.historyDotTextBad]}>
                      {bad ? '✕' : '✔'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.historyTitle, isLast && !bad && { color: tokens.accent }]}>
                      {STATUS_LABELS[h.status] ?? h.status}
                    </Text>
                    {h.status === 'STORE_ACCEPTED' && (
                      <Text style={[styles.mutedSmall, { marginTop: 2 }]}>
                        {h.changedByUserId == null ? 'System (auto-accept)' : 'Accepted by staff'}
                      </Text>
                    )}
                    <Text style={styles.mutedSmall}>{formatDate(h.createdAt)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Products</Text>
          {order.items.map((item) => {
            const lineTotal = Number(item.quantity) * Number(item.price);
            return (
              <View key={item.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemText}>
                    {item.product.name} × {Number(item.quantity)}
                  </Text>
                  {canEditItems && (
                    <View style={styles.itemActions}>
                      <TouchableOpacity onPress={() => openQtyModal(item)} style={styles.miniBtn}>
                        <Text style={styles.miniBtnText}>Edit qty</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => patchItemRemove(item.id, item.product.name)} style={styles.miniBtn}>
                        <Text style={styles.miniBtnText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <Text style={styles.lineTotal}>Rs {lineTotal.toFixed(0)}</Text>
              </View>
            );
          })}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>Rs {Number(order.totalAmount).toFixed(0)}</Text>
          </View>
        </View>
      </ScrollView>

      <Modal visible={!!qtyModal} transparent animationType="fade" onRequestClose={() => setQtyModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New quantity</Text>
            <Text style={styles.mutedSmall}>{qtyModal?.name} (current {qtyModal?.current})</Text>
            <TextInput
              value={qtyInput}
              onChangeText={setQtyInput}
              keyboardType="number-pad"
              style={styles.input}
              placeholder="Quantity"
            />
            <VybeButton title="Save" onPress={submitQtyModal} style={styles.actionBtn} />
            <VybeButton title="Cancel" variant="outline" onPress={() => setQtyModal(null)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={cancelModalOpen} transparent animationType="fade" onRequestClose={() => setCancelModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cancel order</Text>
            <Text style={styles.mutedSmall}>Optional: pick a reason for the record.</Text>
            <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={styles.reasonRow}
                onPress={() => {
                  setCancelModalOpen(false);
                  updateStatus('CANCELLED');
                }}
              >
                <Text style={styles.bodyText}>No specific reason</Text>
              </TouchableOpacity>
              {Object.entries(CANCELLATION_LABELS).map(([k, label]) => (
                <TouchableOpacity
                  key={k}
                  style={styles.reasonRow}
                  onPress={() => {
                    setCancelModalOpen(false);
                    updateStatus('CANCELLED', { cancellationReason: k });
                  }}
                >
                  <Text style={styles.bodyText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <VybeButton title="Close" variant="outline" onPress={() => setCancelModalOpen(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={!!riderModal} transparent animationType="slide" onRequestClose={() => setRiderModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.riderModalCard}>
            <Text style={styles.modalTitle}>{riderModal === 'assign' ? 'Assign rider' : 'Select new rider'}</Text>
            {riderModal === 'reassign' && (
              <>
                <Text style={styles.mutedSmall}>Reason (optional)</Text>
                <TextInput
                  value={reassignReason}
                  onChangeText={setReassignReason}
                  style={styles.input}
                  placeholder="Reason"
                />
              </>
            )}
            <FlatList
              data={riders}
              keyExtractor={(r) => r.id}
              style={{ maxHeight: 280 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.riderRow} onPress={() => onPickRider(item.id)}>
                  <Text style={styles.riderName}>{item.name}</Text>
                  <Text style={styles.mutedSmall}>{item.phone}</Text>
                </TouchableOpacity>
              )}
            />
            <VybeButton title="Close" variant="outline" onPress={() => setRiderModal(null)} />
          </View>
        </View>
      </Modal>
    </PartnerScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32, gap: 12 },
  centerRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  empty: { color: tokens.slate500, textAlign: 'center' },
  card: {
    backgroundColor: tokens.surface,
    borderRadius: tokens.radiusCard,
    padding: 14,
    ...tokens.shadowSoft,
  },
  muted: { fontSize: 12, color: tokens.slate500, marginTop: 4 },
  mutedSmall: { fontSize: 11, color: tokens.slate400, marginTop: 4 },
  title: { fontSize: 17, fontWeight: '700', color: tokens.slate800, marginTop: 6 },
  status: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '700',
    color: tokens.accent,
    textTransform: 'uppercase',
  },
  cancelNote: { marginTop: 8, fontSize: 13, color: '#b91c1c' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: tokens.slate800, marginBottom: 8 },
  bodyText: { fontSize: 14, color: tokens.slate600, lineHeight: 20 },
  actionBtn: { marginTop: 8 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.slate100,
  },
  itemText: { fontSize: 14, color: tokens.slate800 },
  itemActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  miniBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.slate200,
  },
  miniBtnText: { fontSize: 11, fontWeight: '600', color: tokens.slate600 },
  lineTotal: { fontSize: 14, fontWeight: '700', color: tokens.accent },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: tokens.slate100,
  },
  totalLabel: { fontSize: 15, fontWeight: '800', color: tokens.slate800 },
  totalValue: { fontSize: 15, fontWeight: '800', color: tokens.accent },
  historyRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  historyDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyDotOk: { backgroundColor: tokens.primaryDark },
  historyDotBad: { backgroundColor: '#fee2e2' },
  historyDotText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  historyDotTextBad: { color: '#b91c1c' },
  historyTitle: { fontSize: 14, fontWeight: '600', color: tokens.slate700 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: tokens.surface,
    borderRadius: 16,
    padding: 16,
  },
  riderModalCard: {
    backgroundColor: tokens.surface,
    borderRadius: 16,
    padding: 16,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: tokens.slate800, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: tokens.slate200,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    fontSize: 16,
    color: tokens.slate800,
  },
  riderRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.slate100,
  },
  riderName: { fontSize: 15, fontWeight: '600', color: tokens.slate800 },
  reasonRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.slate100,
  },
});
