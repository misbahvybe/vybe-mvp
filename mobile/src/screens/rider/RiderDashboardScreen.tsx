import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Linking, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@store/auth';
import { api } from '@api/client';

interface RiderDashboard {
  isAvailable: boolean;
  todayEarnings: number;
  completedToday: number;
}

interface Order {
  id: string;
  orderStatus: string;
  createdAt: string;
  totalAmount: number;
  paymentMethod?: string;
  store?: { name: string; address?: string; latitude?: number; longitude?: number };
  customer?: { name: string; phone: string };
  address?: { fullAddress: string; latitude?: number; longitude?: number };
}

function googleMapsUrl(lat?: number, lng?: number, address?: string): string {
  if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  if (address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  }
  return 'https://www.google.com/maps';
}

export function RiderDashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const navigation = useNavigation<any>();
  const [dashboard, setDashboard] = useState<RiderDashboard | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    Promise.all([
      api.get<Order[]>('/orders').then((r) => r.data ?? []),
      api.get<RiderDashboard>('/riders/me').then((r) => r.data)
    ])
      .then(([ords, dash]) => {
        setOrders(ords);
        setDashboard(dash ?? { isAvailable: true, todayEarnings: 0, completedToday: 0 });
      })
      .catch(() => {
        setOrders([]);
        setDashboard({ isAvailable: true, todayEarnings: 0, completedToday: 0 });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setAvailable = async (isAvailable: boolean) => {
    try {
      await api.patch('/riders/me', { isAvailable });
      setDashboard((d) => (d ? { ...d, isAvailable } : null));
    } catch {
      // ignore
    }
  };

  const updateStatus = async (orderId: string, status: string) => {
    setActionLoadingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      fetchData();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to update order';
      Alert.alert('Error', String(msg));
    } finally {
      setActionLoadingId(null);
    }
  };

  const requestWithdraw = () => {
    const suggested = dashboard?.todayEarnings ?? 0;
    const amountStr = prompt?.('Withdraw amount (PKR)', String(suggested));
    if (!amountStr) return;
    const amount = Number(amountStr);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid amount');
      return;
    }
    (async () => {
      try {
        await api.post('/withdraw/request', { amount });
        Alert.alert(
          'Request submitted',
          'Withdraw request submitted. Admin will process within 24 hours.'
        );
      } catch (e: any) {
        const msg = e?.response?.data?.message ?? 'Failed to submit withdraw request';
        Alert.alert('Error', String(msg));
      }
    })();
  };

  const active = orders.filter((o) =>
    ['RIDER_ASSIGNED', 'RIDER_ACCEPTED', 'PICKED_UP'].includes(o.orderStatus)
  );
  const sortOrder = (a: Order, b: Order) => {
    const prio: Record<string, number> = { RIDER_ACCEPTED: 0, PICKED_UP: 1, RIDER_ASSIGNED: 2 };
    return (prio[a.orderStatus] ?? 99) - (prio[b.orderStatus] ?? 99);
  };
  const sortedActive = [...active].sort(sortOrder);
  const activeOrder = sortedActive[0];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rider Dashboard</Text>
        <Text style={styles.headerSubtitle}>Welcome, {user?.name ?? 'Rider'}!</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Status</Text>
          <TouchableOpacity
            onPress={() => setAvailable(!(dashboard?.isAvailable ?? true))}
            style={[
              styles.switch,
              dashboard?.isAvailable ? styles.switchOn : styles.switchOff
            ]}
          >
            <View
              style={[
                styles.switchThumb,
                dashboard?.isAvailable ? styles.switchThumbOn : styles.switchThumbOff
              ]}
            />
          </TouchableOpacity>
        </View>
        <Text
          style={[
            styles.statusText,
            dashboard?.isAvailable ? styles.statusTextOnline : styles.statusTextOffline
          ]}
        >
          {dashboard?.isAvailable ? 'Online' : 'Offline'}
        </Text>

        <View style={styles.row}>
          <View style={styles.card}>
            <View>
              <Text style={styles.cardLabel}>Today Earnings</Text>
              <Text style={styles.cardValue}>
                {loading
                  ? '—'
                  : `${Number(dashboard?.todayEarnings ?? 0).toLocaleString()} PKR`}
              </Text>
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={requestWithdraw}>
              <Text style={styles.primaryButtonText}>Request Withdraw</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('RiderEarnings')}
          >
            <Text style={styles.cardLabel}>Earnings</Text>
            <Text style={styles.cardValue}>
              {loading ? '—' : dashboard?.completedToday ?? 0}
            </Text>
            <Text style={styles.cardHint}>Completed orders</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active order</Text>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#0ea5e9" />
            </View>
          ) : !activeOrder ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No active order</Text>
              <Text style={styles.emptyText}>
                Admin will assign you orders when ready.
              </Text>
            </View>
          ) : (
            <View style={styles.activeCard}>
              <Text style={styles.activeTitle}>
                Order #{activeOrder.id.slice(-8).toUpperCase()}
              </Text>
              <Text style={styles.activeSubTitle}>
                {activeOrder.store?.name ?? 'Store'} →{' '}
                {activeOrder.customer?.name ?? 'Customer'}
              </Text>
              <View style={styles.activeButtonsRow}>
                {activeOrder.orderStatus === 'RIDER_ASSIGNED' && (
                  <>
                    <TouchableOpacity
                      style={[styles.primaryButton, styles.flex1]}
                      disabled={actionLoadingId === activeOrder.id}
                      onPress={() => updateStatus(activeOrder.id, 'RIDER_ACCEPTED')}
                    >
                      {actionLoadingId === activeOrder.id ? (
                        <ActivityIndicator color="#000000" />
                      ) : (
                        <Text style={styles.primaryButtonText}>Accept</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.secondaryButton]}
                      disabled={!!actionLoadingId}
                      onPress={() => updateStatus(activeOrder.id, 'READY_FOR_PICKUP')}
                    >
                      <Text style={styles.secondaryButtonText}>Reject</Text>
                    </TouchableOpacity>
                  </>
                )}
                {activeOrder.orderStatus === 'RIDER_ACCEPTED' && (
                  <>
                    <TouchableOpacity
                      style={[styles.secondaryButton, styles.flex1]}
                      onPress={() =>
                        Linking.openURL(
                          googleMapsUrl(
                            activeOrder.store?.latitude,
                            activeOrder.store?.longitude,
                            activeOrder.store?.address
                          )
                        )
                      }
                    >
                      <Text style={styles.secondaryButtonText}>Navigate to Store</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryButton, styles.flex1]}
                      disabled={actionLoadingId === activeOrder.id}
                      onPress={() => updateStatus(activeOrder.id, 'PICKED_UP')}
                    >
                      {actionLoadingId === activeOrder.id ? (
                        <ActivityIndicator color="#000000" />
                      ) : (
                        <Text style={styles.primaryButtonText}>Picked Up</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
                {activeOrder.orderStatus === 'PICKED_UP' && (
                  <>
                    <TouchableOpacity
                      style={[styles.secondaryButton, styles.flex1]}
                      onPress={() =>
                        Linking.openURL(
                          googleMapsUrl(
                            activeOrder.address?.latitude,
                            activeOrder.address?.longitude,
                            activeOrder.address?.fullAddress
                          )
                        )
                      }
                    >
                      <Text style={styles.secondaryButtonText}>Navigate to Customer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryButton, styles.flex1]}
                      disabled={actionLoadingId === activeOrder.id}
                      onPress={() => updateStatus(activeOrder.id, 'DELIVERED')}
                    >
                      {actionLoadingId === activeOrder.id ? (
                        <ActivityIndicator color="#000000" />
                      ) : (
                        <Text style={styles.primaryButtonText}>Delivered</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => navigation.navigate('RiderOrders')}
              >
                <Text style={styles.linkButtonText}>View all orders</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
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
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a'
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b'
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0f172a'
  },
  switch: {
    width: 56,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 2,
    justifyContent: 'center'
  },
  switchOn: {
    backgroundColor: '#22c55e'
  },
  switchOff: {
    backgroundColor: '#cbd5e1'
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff'
  },
  switchThumbOn: {
    alignSelf: 'flex-end'
  },
  switchThumbOff: {
    alignSelf: 'flex-start'
  },
  statusText: {
    fontSize: 13,
    marginBottom: 12
  },
  statusTextOnline: {
    color: '#16a34a'
  },
  statusTextOffline: {
    color: '#6b7280'
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  card: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 14,
    justifyContent: 'space-between',
    shadowColor: '#020617',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  cardLabel: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a'
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    alignItems: 'center'
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#facc15'
  },
  section: {
    marginTop: 8
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8
  },
  center: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 16,
    alignItems: 'center'
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563'
  },
  emptyText: {
    marginTop: 4,
    fontSize: 13,
    color: '#9ca3af'
  },
  activeCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 16,
    shadowColor: '#020617',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  activeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4
  },
  activeSubTitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8
  },
  activeButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8
  },
  flex1: {
    flex: 1
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center'
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4b5563'
  },
  linkButton: {
    marginTop: 10,
    alignSelf: 'flex-start'
  },
  linkButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0ea5e9'
  }
});

