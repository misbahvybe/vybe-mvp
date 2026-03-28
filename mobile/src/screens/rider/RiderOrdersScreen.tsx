import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RiderHomeStackParamList } from '@navigation/RiderTabs';
import { api } from '@api/client';
import { PartnerScreenShell } from '@components/partner/PartnerScreenShell';
import { tokens } from '@theme/tokens';

interface Order {
  id: string;
  orderStatus: string;
  createdAt: string;
  totalAmount: number;
  store?: { name: string };
}

const DELIVERY_FEE = 150;

type Nav = NativeStackNavigationProp<RiderHomeStackParamList>;

export function RiderOrdersScreen() {
  const navigation = useNavigation<Nav>();
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
    <PartnerScreenShell
      title="Orders"
      scrollable={false}
      bottomPadding="nav"
      showBack={navigation.canGoBack()}
      onBack={() => navigation.goBack()}
    >
      <View style={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.accent} />
          </View>
        ) : (
          <FlatList
            ListHeaderComponent={
              <View style={{ gap: 16 }}>
                <Section
                  title="Active / Assigned"
                  emptyText="No active orders"
                  orders={active}
                  onSelectOrder={(o) => navigation.navigate('RiderOrderDetail', { id: o.id })}
                />
                <Section
                  title="Completed (Delivered)"
                  emptyText="No completed orders yet"
                  orders={completed}
                  onSelectOrder={(o) => navigation.navigate('RiderOrderDetail', { id: o.id })}
                />
              </View>
            }
            data={[]}
            renderItem={null}
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
  onSelectOrder: (o: Order) => void;
}

function Section({ title, emptyText, orders, onSelectOrder }: SectionProps) {
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
            <TouchableOpacity
              key={o.id}
              style={styles.orderCard}
              activeOpacity={0.85}
              onPress={() => onSelectOrder(o)}
            >
              <View>
                <Text style={styles.orderId}>#{o.id.slice(-8).toUpperCase()}</Text>
                <Text style={styles.orderStore}>{o.store?.name ?? 'Store'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.badge}>{o.orderStatus}</Text>
                <Text style={styles.orderAmount}>{DELIVERY_FEE} PKR</Text>
              </View>
            </TouchableOpacity>
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
    paddingTop: 8
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
    color: tokens.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6
  },
  sectionCard: {
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 12,
    alignItems: 'center',
    ...tokens.shadowSoft
  },
  sectionEmpty: {
    fontSize: 13,
    color: tokens.slate400
  },
  orderCard: {
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...tokens.shadowSoft
  },
  orderId: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.slate800
  },
  orderStore: {
    marginTop: 2,
    fontSize: 13,
    color: tokens.slate500
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '500',
    color: tokens.slate800,
    backgroundColor: tokens.slate200
  },
  orderAmount: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.accent
  }
});
