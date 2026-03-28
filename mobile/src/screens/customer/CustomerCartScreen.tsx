import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCartStore } from '@store/cart';
import { CustomerScreenShell } from '@components/customer/CustomerScreenShell';
import { VybeButton } from '@components/ui/VybeButton';
import { tokens } from '@theme/tokens';

export function CustomerCartScreen() {
  const navigation = useNavigation<any>();
  const { items, updateQty, total } = useCartStore();
  const totalAmount = total();

  const goBrowse = () =>
    navigation.getParent()?.navigate('HomeTab', { screen: 'CustomerHome' });

  return (
    <CustomerScreenShell title="My Cart" scrollable={false} bottomPadding="nav">
      <View style={styles.body}>
        {items.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>Your cart is empty</Text>
            <VybeButton title="Browse stores" variant="accent" onPress={goBrowse} />
          </View>
        ) : (
          <>
            <FlatList
              contentContainerStyle={{ paddingBottom: 16, gap: 12, paddingHorizontal: 16, paddingTop: 8 }}
              data={items}
              keyExtractor={(item) => item.productId}
              renderItem={({ item }) => (
                <View style={styles.itemCard}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemPrice}>Rs {item.unitPrice.toFixed(0)}</Text>
                  </View>
                  <View style={styles.qtyControls}>
                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() => updateQty(item.productId, item.quantityKg + 1)}
                    >
                      <Text style={styles.qtyButtonText}>+</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>
                      {String(item.quantityKg).padStart(2, '0')}
                    </Text>
                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() => updateQty(item.productId, item.quantityKg - 1)}
                    >
                      <Text style={styles.qtyButtonText}>−</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
            <View style={styles.footer}>
              <Text style={styles.totalText}>
                Total amount Rs {totalAmount.toFixed(0)}
              </Text>
              <VybeButton
                title="Checkout"
                variant="accent"
                size="lg"
                fullWidth
                onPress={() => navigation.navigate('Checkout')}
              />
            </View>
          </>
        )}
      </View>
    </CustomerScreenShell>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24
  },
  emptyText: {
    fontSize: 14,
    color: tokens.slate500
  },
  itemCard: {
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...tokens.shadowSoft
  },
  itemInfo: {
    flex: 1
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.slate800
  },
  itemPrice: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.accent
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
    width: 26,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: tokens.slate800
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.slate200,
    backgroundColor: tokens.surface
  },
  totalText: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.slate800
  }
});
