import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';

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
  store?: { name: string };
  items: OrderItem[];
}

export function CustomerOrdersScreen() {
  const navigation = useNavigation<any>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Order[]>('/orders')
      .then((res) => setOrders(res.data ?? []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>&lt; Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>
      <View style={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#0ea5e9" />
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.empty}>No orders yet.</Text>
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(o) => o.id}
            contentContainerStyle={{ paddingBottom: 16, gap: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('CustomerOrderDetail', { id: item.id })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.store?.name ?? 'Order'}</Text>
                  <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
                  <Text style={styles.cardAmount}>
                    Rs {Number(item.totalAmount).toFixed(0)}
                  </Text>
                </View>
                <Text style={styles.status}>{item.orderStatus}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
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
  back: { color: '#0ea5e9', fontSize: 14, fontWeight: '500' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { fontSize: 14, color: '#64748b' },
  card: {
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
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  cardDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  cardAmount: { marginTop: 2, fontSize: 13, fontWeight: '600', color: '#f97316' },
  status: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    color: '#0f172a',
    fontWeight: '500'
  }
});

