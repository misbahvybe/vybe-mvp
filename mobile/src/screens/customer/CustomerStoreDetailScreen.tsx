import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SectionList
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
  variants?: { id: string; name: string; price: number; isAvailable: boolean; sortOrder: number }[];
}

interface Store {
  id: string;
  name: string;
  description: string | null;
  address?: string | null;
  isOpenNow?: boolean;
  status?: 'INVITED' | 'ACTIVE' | 'INACTIVE';
  menuAvailable?: boolean;
  menuMessage?: string | null;
  products: Product[];
  productCategories?: { id: string; name: string; sortOrder: number; products: Product[] }[];
}

export function CustomerStoreDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const id: string = route.params?.id;

  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariantByProduct, setSelectedVariantByProduct] = useState<Record<string, string>>({});

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

  const availableProducts = useMemo(() => store.products.filter((p) => p.isAvailable !== false), [store.products]);
  const categorizedIds = new Set<string>();
  for (const c of store.productCategories ?? []) {
    for (const p of c.products ?? []) categorizedIds.add(p.id);
  }
  const uncategorized = availableProducts.filter((p) => !categorizedIds.has(p.id));
  const sections = [
    ...(store.productCategories ?? []).map((c) => ({
      title: c.name,
      data: (c.products ?? []).filter((p) => p.isAvailable !== false),
    })),
    ...(uncategorized.length > 0 ? [{ title: 'More', data: uncategorized }] : []),
  ].filter((s) => s.data.length > 0);

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
            <Text style={styles.bannerTitle}>
              {store.menuMessage?.includes('Not accepting') ? 'Not taking new orders' : 'Store is closed'}
            </Text>
            <Text style={styles.bannerText}>
              {store.menuMessage ??
                'Orders are not accepted at this time. Please check back during business hours.'}
            </Text>
          </View>
        )}

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 160, paddingHorizontal: 16, paddingTop: 8 }}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )}
          ListEmptyComponent={
            <View style={styles.emptyMenuWrap}>
              <Text style={styles.emptyMenuTitle}>
                {store.menuMessage ||
                  (store.status === 'INVITED'
                    ? 'Menu not available yet'
                    : store.status === 'INACTIVE'
                      ? 'Store is currently unavailable'
                      : 'Menu not available yet')}
              </Text>
              <Text style={styles.emptyMenuText}>
                {store.status === 'INVITED'
                  ? 'This store is still being onboarded. Please check back soon.'
                  : store.status === 'INACTIVE'
                    ? 'Please try another store for now.'
                    : 'No items have been added yet.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const variants = (item.variants ?? []).filter((v) => v.isAvailable !== false);
            const selectedVariantId = selectedVariantByProduct[item.id];
            const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? null;
            const lineId = `${item.id}:${selectedVariant?.id ?? ''}`;
            const qty = isSameStoreCart ? items.find((i) => i.lineId === lineId)?.quantityKg ?? 0 : 0;
            const available = !item.isOutOfStock && store.isOpenNow !== false;
            const unitPrice = selectedVariant ? Number(selectedVariant.price) : Number(item.price);
            const mustPickVariant = variants.length > 0 && !selectedVariant;

            return (
              <View style={[styles.productCard, !available && { opacity: 0.6 }]}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productPrice}>Rs {unitPrice.toFixed(0)}</Text>
                  {variants.length > 0 && (
                    <View style={styles.variantRow}>
                      {variants.map((v) => {
                        const active = v.id === selectedVariantId;
                        return (
                          <TouchableOpacity
                            key={v.id}
                            style={[styles.variantChip, active && styles.variantChipActive]}
                            onPress={() =>
                              setSelectedVariantByProduct((m) => ({ ...m, [item.id]: v.id }))
                            }
                            disabled={!available}
                          >
                            <Text style={[styles.variantChipText, active && styles.variantChipTextActive]}>
                              {v.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                  {mustPickVariant && (
                    <Text style={styles.pickVariantText}>Select a size</Text>
                  )}
                </View>
                <View style={styles.productActions}>
                  {available && qty > 0 && (
                    <View style={styles.qtyControls}>
                      <TouchableOpacity
                        style={styles.qtyButton}
                        onPress={() => updateQty(lineId, qty - 1)}
                      >
                        <Text style={styles.qtyButtonText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{qty}</Text>
                    </View>
                  )}
                  {available && (
                    <TouchableOpacity
                      style={[styles.addButton, mustPickVariant && styles.addButtonDisabled]}
                      onPress={() => {
                        if (mustPickVariant) return;
                        addItem({
                          lineId,
                          productId: item.id,
                          variantId: selectedVariant?.id ?? null,
                          variantName: selectedVariant?.name ?? null,
                          storeId: store.id,
                          name: item.name,
                          unitPrice,
                          quantityKg: 1,
                          imageUrl: item.imageUrl
                        });
                      }}
                      disabled={mustPickVariant}
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
  emptyMenuWrap: {
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 14,
    marginTop: 8,
    ...tokens.shadowSoft
  },
  emptyMenuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.slate800
  },
  emptyMenuText: {
    marginTop: 6,
    fontSize: 12,
    color: tokens.slate500
  },
  sectionTitle: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '700',
    color: tokens.slate800
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
    borderColor: tokens.primary,
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
  variantRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8
  },
  variantChip: {
    borderWidth: 1,
    borderColor: tokens.slate200,
    backgroundColor: tokens.slate50,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999
  },
  variantChipActive: {
    borderColor: tokens.accent,
    backgroundColor: '#fff7ed'
  },
  variantChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.slate700
  },
  variantChipTextActive: {
    color: tokens.accent
  },
  pickVariantText: {
    marginTop: 6,
    fontSize: 12,
    color: tokens.slate500
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
  addButtonDisabled: {
    backgroundColor: tokens.slate300
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
