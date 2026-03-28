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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@api/client';
import { useCartStore } from '@store/cart';
import { CustomerScreenShell } from '@components/customer/CustomerScreenShell';
import { VybeButton } from '@components/ui/VybeButton';
import { tokens } from '@theme/tokens';

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
  const insets = useSafeAreaInsets();
  const id: string = route.params?.id;

  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  const addItem = useCartStore((s) => s.addItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const { items, storeId, total } = useCartStore();

  const goCart = () =>
    navigation.getParent()?.navigate('CartTab', { screen: 'Cart' });

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
      <CustomerScreenShell
        title="Store"
        showBack
        onBack={() => navigation.goBack()}
        scrollable={false}
        bottomPadding="nav"
      >
        <View style={styles.centerFlex}>
          <ActivityIndicator color={tokens.accent} />
        </View>
      </CustomerScreenShell>
    );
  }

  if (!store) {
    return (
      <CustomerScreenShell
        title="Store"
        showBack
        onBack={() => navigation.goBack()}
        bottomPadding="nav"
      >
        <View style={styles.centerFlex}>
          <Text style={styles.emptyText}>Store not found</Text>
        </View>
      </CustomerScreenShell>
    );
  }

  const isSameStoreCart = storeId === store.id && items.length > 0;
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <CustomerScreenShell
      title={store.name}
      showBack
      onBack={() => navigation.goBack()}
      scrollable={false}
      bottomPadding="none"
    >
      <View style={styles.inner}>
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
          contentContainerStyle={{ paddingBottom: 160, gap: 12, paddingHorizontal: 16, paddingTop: 8 }}
          renderItem={({ item }) => {
            const qty =
              isSameStoreCart && items.find((i) => i.productId === item.id)?.quantityKg
                ? items.find((i) => i.productId === item.id)!.quantityKg
                : 0;
            const available = !item.isOutOfStock && store.isOpenNow !== false;
            return (
              <View style={[styles.productCard, !available && { opacity: 0.6 }]}>
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

        <View style={[styles.bottomBar, { paddingBottom: bottomInset + 8 }]}>
          {store.isOpenNow === false ? (
            <VybeButton
              title="Store closed – orders unavailable"
              variant="primary"
              fullWidth
              disabled
            />
          ) : isSameStoreCart ? (
            <>
              <View style={styles.cartSummary}>
                <Text style={styles.cartSummaryLabel}>Cart total</Text>
                <Text style={styles.cartSummaryValue}>Rs {total().toFixed(0)}</Text>
              </View>
              <VybeButton title="View Cart" variant="accent" fullWidth onPress={goCart} />
            </>
          ) : (
            <VybeButton title="View Cart" variant="accent" fullWidth onPress={goCart} />
          )}
        </View>
      </View>
    </CustomerScreenShell>
  );
}

const styles = StyleSheet.create({
  inner: {
    flex: 1
  },
  centerFlex: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24
  },
  emptyText: {
    fontSize: 14,
    color: tokens.slate500
  },
  description: {
    fontSize: 13,
    color: tokens.slate500,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 8
  },
  bannerClosed: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#facc15',
    backgroundColor: '#fefce8',
    padding: 12,
    marginHorizontal: 16,
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
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 12,
    ...tokens.shadowSoft
  },
  productInfo: {
    flex: 1
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.slate800
  },
  productPrice: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '600',
    color: tokens.accent
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
    backgroundColor: tokens.slate200,
    justifyContent: 'center',
    alignItems: 'center'
  },
  qtyButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: tokens.slate800
  },
  qtyText: {
    width: 20,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: tokens.slate800
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.accent,
    justifyContent: 'center',
    alignItems: 'center'
  },
  addButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.white
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: tokens.slate50,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.slate200
  },
  cartSummary: {
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...tokens.shadowSoft
  },
  cartSummaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.slate800
  },
  cartSummaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.accent
  }
});
