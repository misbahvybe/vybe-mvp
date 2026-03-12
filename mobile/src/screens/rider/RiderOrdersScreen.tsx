import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';

interface Order {
  id: string;
  orderStatus: string;
  createdAt: string;
  totalAmount: number;
  store?: { name: string };
}

const DELIVERY_FEE = 150;

export function RiderOrdersScreen() {
  const navigation = useNavigation<any>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(() => {
    api
      .get<Order[]>('/orders')
      .then((r) => setOrders(r.data ?? []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const active = orders.filter((o) =>
    ['RIDER_ASSIGNED', 'RIDER_ACCEPTED', 'PICKED_UP'].includes(o.orderStatus)
  );
  const completed = orders.filter((o) => o.orderStatus === 'DELIVERED');

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>&lt; Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rider Orders</Text>
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
                <Section title="Active / Assigned" emptyText="No active orders" orders={active} />
                <Section
                  title="Completed (Delivered)"
                  emptyText="No completed orders yet"
                  orders={completed}
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
}

function Section({ title, emptyText, orders }: SectionProps) {
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
              <View>
                <Text style={styles.orderId}>#{o.id.slice(-8).toUpperCase()}</Text>
                <Text style={styles.orderStore}>{o.store?.name ?? 'Store'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.badge}>{o.orderStatus}</Text>
                <Text style={styles.orderAmount}>{DELIVERY_FEE} PKR</Text>
              </View>
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
    fontSize: 14,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#020617',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1
  },
  orderId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a'
  },
  orderStore: {
    marginTop: 2,
    fontSize: 13,
    color: '#64748b'
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '500',
    color: '#0f172a',
    backgroundColor: '#e5e7eb'
  },
  orderAmount: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#f97316'
  }
});

