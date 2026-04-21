import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { useAuthStore } from '@store/auth';
import { useOrdersRealtime } from '@hooks/useOrdersRealtime';
import { PartnerScreenShell } from '@components/partner/PartnerScreenShell';
import { tokens } from '@theme/tokens';
import { formatOrderNo } from '@lib/orderDisplay';

const POLL_INTERVAL_MS = 120000;

interface OrderItem {
  product: { name: string };
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  orderNumber?: number;
  orderStatus: string;
  createdAt: string;
  totalAmount: number;
  items: OrderItem[];
}

function timeAgo(d: string) {
  const sec = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)} mins ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export function StoreOrdersScreen() {
  const navigation = useNavigation<any>();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [myStoreId, setMyStoreId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchOrders = useCallback(() => {
    api
      .get<Order[]>('/orders')
      .then((res) => setOrders(res.data ?? []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!token || user?.role !== 'STORE_OWNER') return;
    api
      .get<{ id: string }>('/store-owner/store')
      .then((r) => setMyStoreId(r.data?.id ?? null))
      .catch(() => setMyStoreId(null));
  }, [token, user?.role]);

  useOrdersRealtime(
    !!token && user?.role === 'STORE_OWNER' && !!myStoreId,
    token,
    'STORE_OWNER',
    myStoreId,
    fetchOrders,
  );

  useEffect(() => {
    const id = setInterval(fetchOrders, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchOrders]);

  const updateOrderStatus = async (orderId: string, status: string) => {
    setActionLoadingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      fetchOrders();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to update order';
      Alert.alert('Error', String(msg));
    } finally {
      setActionLoadingId(null);
    }
  };

  const pending = orders.filter((o) => o.orderStatus === 'PENDING');
  const preparing = orders.filter((o) => o.orderStatus === 'STORE_ACCEPTED');
  const ready = orders.filter((o) => o.orderStatus === 'READY_FOR_PICKUP');
  const delivered = orders.filter((o) => o.orderStatus === 'DELIVERED');

  return (
    <PartnerScreenShell title="Orders" scrollable={false} bottomPadding="nav">
      <View style={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.accent} />
          </View>
        ) : (
          <FlatList
            data={[]}
            keyExtractor={() => '_'}
            renderItem={() => null}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <View style={{ gap: 16 }}>
                <Section
                  title="New Orders"
                  emptyText="No new orders"
                  orders={pending}
                  actionLoadingId={actionLoadingId}
                  onOpenDetail={(id) => navigation.navigate('StoreOrderDetail', { id })}
                  onAccept={(id) => updateOrderStatus(id, 'STORE_ACCEPTED')}
                  onReject={(id) => updateOrderStatus(id, 'STORE_REJECTED')}
                />
                <Section
                  title="Preparing"
                  emptyText="None"
                  orders={preparing}
                  actionLoadingId={actionLoadingId}
                  onOpenDetail={(id) => navigation.navigate('StoreOrderDetail', { id })}
                  onMarkReady={(id) => updateOrderStatus(id, 'READY_FOR_PICKUP')}
                />
                <Section
                  title="Ready for Pickup"
                  emptyText="None"
                  orders={ready}
                  onOpenDetail={(id) => navigation.navigate('StoreOrderDetail', { id })}
                />
                <Section
                  title="Completed"
                  emptyText="No completed orders yet"
                  orders={delivered.slice(0, 10)}
                  onOpenDetail={(id) => navigation.navigate('StoreOrderDetail', { id })}
                />
              </View>
            }
          />
        )}
      </View>
    </PartnerScreenShell>
  );
}

interface SectionProps {
  title: string;
  emptyText: string;
  orders: Order[];
  actionLoadingId?: string | null;
  onOpenDetail?: (id: string) => void;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onMarkReady?: (id: string) => void;
}

function Section({
  title,
  emptyText,
  orders,
  actionLoadingId,
  onOpenDetail,
  onAccept,
  onReject,
  onMarkReady
}: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {orders.length === 0 ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionEmpty}>{emptyText}</Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {orders.map((o) => (
            <View key={o.id} style={styles.orderCard}>
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={0.75}
                onPress={() => onOpenDetail?.(o.id)}
                disabled={!onOpenDetail}
              >
                <View style={styles.orderHeaderRow}>
                  <Text style={styles.orderId}>{formatOrderNo(o.orderNumber, o.id)}</Text>
                  <Text style={styles.orderTime}>{timeAgo(o.createdAt)}</Text>
                </View>
                <Text style={styles.orderSummary}>
                  {o.items.length} items · {Number(o.totalAmount).toLocaleString()} PKR
                </Text>
                {onOpenDetail ? <Text style={styles.openDetailHint}>Tap for details</Text> : null}
              </TouchableOpacity>
              {(onAccept || onReject || onMarkReady) && (
                <View style={styles.orderActions}>
                  {onAccept && (
                    <TouchableOpacity
                      style={styles.primaryPill}
                      onPress={() => onAccept(o.id)}
                      disabled={actionLoadingId === o.id}
                    >
                      {actionLoadingId === o.id ? (
                        <ActivityIndicator color="#000000" />
                      ) : (
                        <Text style={styles.primaryPillText}>Accept</Text>
                      )}
                    </TouchableOpacity>
                  )}
                  {onReject && (
                    <TouchableOpacity
                      style={styles.secondaryPill}
                      onPress={() => onReject(o.id)}
                      disabled={!!actionLoadingId}
                    >
                      <Text style={styles.secondaryPillText}>Reject</Text>
                    </TouchableOpacity>
                  )}
                  {onMarkReady && (
                    <TouchableOpacity
                      style={styles.primaryPill}
                      onPress={() => onMarkReady(o.id)}
                      disabled={actionLoadingId === o.id}
                    >
                      {actionLoadingId === o.id ? (
                        <ActivityIndicator color="#000000" />
                      ) : (
                        <Text style={styles.primaryPillText}>Ready</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  listContent: {
    paddingBottom: 24,
    flexGrow: 1
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  section: {
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6
  },
  sectionCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 12,
    alignItems: 'center'
  },
  sectionEmpty: {
    fontSize: 13,
    color: '#94a3b8'
  },
  orderCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 12,
    shadowColor: '#020617',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  orderId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a'
  },
  orderTime: {
    fontSize: 11,
    color: '#94a3b8'
  },
  orderSummary: {
    fontSize: 13,
    color: '#64748b'
  },
  openDetailHint: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 6,
    fontWeight: '500',
  },
  orderActions: {
    flexDirection: 'column',
    gap: 4
  },
  primaryPill: {
    borderRadius: 999,
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center'
  },
  primaryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#facc15'
  },
  secondaryPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center'
  },
  secondaryPillText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b'
  }
});

