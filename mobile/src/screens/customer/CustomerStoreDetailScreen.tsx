import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  FlatList
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { api } from '@api/client';
import { useCartStore } from '@store/cart';

interface Product {
  id: string;
  name: string;
  price: number;
  stock?: number;
  imageUrl: string | null;
  isAvailable?: boolean;
  isOutOfStock?: boolean;
}

interface Store {
  id: string;
  name: string;
  description: string | null;
  address?: string | null;
  isOpenNow?: boolean;
  products: Product[];
}

export function CustomerStoreDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const id: string = route.params?.id;

  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  const addItem = useCartStore((s) => s.addItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const { items, storeId, total } = useCartStore();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get<Store>(`/stores/${id}`)
      .then((res) => setStore(res.data))
      .catch(() => setStore(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centerRoot}>
        <ActivityIndicator color="#0ea5e9" />
      </View>
    );
  }

  if (!store) {
    return (
      <View style={styles.centerRoot}>
        <Text style={styles.emptyText}>Store not found</Text>
      </View>
    );
  }

  const isSameStoreCart = storeId === store.id && items.length > 0;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>&lt; Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{store.name}</Text>
      </View>
      <View style={styles.body}>
        {store.description ? (
          <Text style={styles.description}>{store.description}</Text>
        ) : null}
        {store.isOpenNow === false && (
          <View style={styles.bannerClosed}>
            <Text style={styles.bannerTitle}>Store is closed</Text>
            <Text style={styles.bannerText}>
              Orders are not accepted at this time. Please check back during business hours.
            </Text>
          </View>
        )}

        <FlatList
          data={store.products.filter((p) => p.isAvailable !== false)}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 96, gap: 12 }}
          renderItem={({ item }) => {
            const qty =
              isSameStoreCart && items.find((i) => i.productId === item.id)?.quantityKg
                ? items.find((i) => i.productId === item.id)!.quantityKg
                : 0;
            const available = !item.isOutOfStock && store.isOpenNow !== false;
            return (
              <View
                style={[
                  styles.productCard,
                  !available && { opacity: 0.6 }
                ]}
              >
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productPrice}>Rs {Number(item.price).toFixed(0)}</Text>
                </View>
                <View style={styles.productActions}>
                  {available && qty > 0 && (
                    <View style={styles.qtyControls}>
                      <TouchableOpacity
                        style={styles.qtyButton}
                        onPress={() => updateQty(item.id, qty - 1)}
                      >
                        <Text style={styles.qtyButtonText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{qty}</Text>
                    </View>
                  )}
                  {available && (
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() =>
                        addItem({
                          productId: item.id,
                          storeId: store.id,
                          name: item.name,
                          unitPrice: Number(item.price),
                          quantityKg: 1,
                          imageUrl: item.imageUrl
                        })
                      }
                    >
                      <Text style={styles.addButtonText}>+</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      </View>
      <View style={styles.bottomBar}>
        {store.isOpenNow === false ? (
          <TouchableOpacity style={[styles.primaryButton, styles.primaryButtonDisabled]} disabled>
            <Text style={styles.primaryButtonText}>Store closed – orders unavailable</Text>
          </TouchableOpacity>
        ) : isSameStoreCart ? (
          <>
            <View style={styles.cartSummary}>
              <Text style={styles.cartSummaryLabel}>Cart total</Text>
              <Text style={styles.cartSummaryValue}>Rs {total().toFixed(0)}</Text>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Cart')}
            >
              <Text style={styles.primaryButtonText}>View Cart</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Cart')}
          >
            <Text style={styles.primaryButtonText}>View Cart</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
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
  description: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8
  },
  bannerClosed: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#facc15',
    backgroundColor: '#fefce8',
    padding: 12,
    marginBottom: 8
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#854d0e'
  },
  bannerText: {
    fontSize: 12,
    color: '#a16207',
    marginTop: 4
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 12,
    shadowColor: '#020617',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1
  },
  productInfo: {
    flex: 1
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a'
  },
  productPrice: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '600',
    color: '#f97316'
  },
  productActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  qtyButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a'
  },
  qtyText: {
    width: 20,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a'
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center'
  },
  addButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff'
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    backgroundColor: '#f8fafc',
    gap: 8
  },
  cartSummary: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#020617',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  cartSummaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a'
  },
  cartSummaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f97316'
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    alignItems: 'center'
  },
  primaryButtonDisabled: {
    backgroundColor: '#94a3b8'
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#facc15'
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b'
  }
});

