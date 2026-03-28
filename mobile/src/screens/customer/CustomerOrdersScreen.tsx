import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { CustomerScreenShell } from '@components/customer/CustomerScreenShell';
import { tokens } from '@theme/tokens';

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
    <CustomerScreenShell title="My Orders" scrollable={false} bottomPadding="nav">
      <View style={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.accent} />
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.empty}>No orders yet.</Text>
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(o) => o.id}
            contentContainerStyle={{ paddingBottom: 16, gap: 10, paddingHorizontal: 16, paddingTop: 8 }}
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
    </CustomerScreenShell>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { fontSize: 14, color: tokens.slate500 },
  card: {
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...tokens.shadowSoft
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: tokens.slate800 },
  cardDate: { fontSize: 12, color: tokens.slate400, marginTop: 2 },
  cardAmount: { marginTop: 2, fontSize: 13, fontWeight: '600', color: tokens.accent },
  status: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: tokens.slate200,
    color: tokens.slate800,
    fontWeight: '500'
  }
});
