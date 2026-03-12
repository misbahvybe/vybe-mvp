import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';

const POLL_INTERVAL_MS = 15000;

interface OrderItem {
  product: { name: string };
  quantity: number;
  price: number;
}

interface Order {
  id: string;
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
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>&lt; Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Orders</Text>
      </View>
      <View style={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#0ea5e9" />
          </View>
        ) : (
          <FlatList
            ListHeaderComponent={
              <View style={{ gap: 16 }}>
                <Section
                  title="New Orders"
                  emptyText="No new orders"
                  orders={pending}
                  actionLoadingId={actionLoadingId}
                  onAccept={(id) => updateOrderStatus(id, 'STORE_ACCEPTED')}
                  onReject={(id) => updateOrderStatus(id, 'STORE_REJECTED')}
                />
                <Section
                  title="Preparing"
                  emptyText="None"
                  orders={preparing}
                  actionLoadingId={actionLoadingId}
                  onMarkReady={(id) => updateOrderStatus(id, 'READY_FOR_PICKUP')}
                />
                <Section
                  title="Ready for Pickup"
                  emptyText="None"
                  orders={ready}
                />
                <Section
                  title="Completed"
                  emptyText="No completed orders yet"
                  orders={delivered.slice(0, 10)}
                />
              </View>
            }
            data={[]}
            renderItem={null}
          />
        )}
      </View>
    </View>
  );
}

interface SectionProps {
  title: string;
  emptyText: string;
  orders: Order[];
  actionLoadingId?: string | null;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onMarkReady?: (id: string) => void;
}

function Section({
  title,
  emptyText,
  orders,
  actionLoadingId,
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
              <View style={{ flex: 1 }}>
                <View style={styles.orderHeaderRow}>
                  <Text style={styles.orderId}>#{o.id.slice(-8).toUpperCase()}</Text>
                  <Text style={styles.orderTime}>{timeAgo(o.createdAt)}</Text>
                </View>
                <Text style={styles.orderSummary}>
                  {o.items.length} items · {Number(o.totalAmount).toLocaleString()} PKR
                </Text>
              </View>
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
  root: {
    flex: 1,
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

