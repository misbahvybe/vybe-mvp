import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { api } from '@api/client';

interface OrderItem {
  id: string;
  product: { name: string };
  quantity: number;
  price: number;
}

interface OrderDetail {
  id: string;
  orderStatus: string;
  createdAt: string;
  totalAmount: number;
  store?: { name: string };
  address?: { fullAddress: string };
  items: OrderItem[];
}

export function CustomerOrderDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const id: string = route.params?.id;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api
      .get<OrderDetail>(`/orders/${id}`)
      .then((res) => setOrder(res.data))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centerRoot}>
        <ActivityIndicator color="#0ea5e9" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centerRoot}>
        <Text style={styles.empty}>Order not found.</Text>
      </View>
    );
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.back} onPress={() => navigation.goBack()}>
          &lt; Back
        </Text>
        <Text style={styles.headerTitle}>Order details</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.muted}>Order #{order.id.slice(-8).toUpperCase()}</Text>
          <Text style={styles.title}>{order.store?.name ?? 'Order'}</Text>
          <Text style={styles.muted}>{formatDate(order.createdAt)}</Text>
          <Text style={styles.status}>{order.orderStatus}</Text>
        </View>
        {order.address && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Delivery address</Text>
            <Text style={styles.body}>{order.address.fullAddress}</Text>
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
            <Text style={styles.totalValue}>
              Rs {Number(order.totalAmount).toFixed(0)}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  centerRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  back: { color: '#0ea5e9', fontSize: 14, fontWeight: '500' },
  headerTitle: { marginTop: 4, fontSize: 18, fontWeight: '700', color: '#0f172a' },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, gap: 12 },
  card: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 16,
    shadowColor: '#020617',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
    marginBottom: 12
  },
  title: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginTop: 4 },
  muted: { fontSize: 13, color: '#94a3b8' },
  status: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    fontSize: 12,
    fontWeight: '500',
    color: '#0f172a'
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
  body: { fontSize: 13, color: '#4b5563' },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb'
  },
  itemText: { fontSize: 13, color: '#0f172a' },
  itemAmount: { fontSize: 13, fontWeight: '600', color: '#f97316' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8
  },
  totalLabel: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  totalValue: { fontSize: 16, fontWeight: '700', color: '#f97316' },
  empty: { fontSize: 14, color: '#6b7280' }
});

