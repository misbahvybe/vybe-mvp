import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCartStore } from '@store/cart';

export function CustomerCartScreen() {
  const navigation = useNavigation<any>();
  const { items, updateQty, total } = useCartStore();
  const totalAmount = total();

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>&lt; Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cart</Text>
      </View>
      <View style={styles.body}>
        {items.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>Your cart is empty</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('CustomerHome')}
            >
              <Text style={styles.primaryButtonText}>Browse stores</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <FlatList
              contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
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
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => navigation.navigate('Checkout')}
              >
                <Text style={styles.primaryButtonText}>Checkout</Text>
              </TouchableOpacity>
            </View>
          </>
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
    alignItems: 'center',
    gap: 12
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b'
  },
  itemCard: {
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
  itemInfo: {
    flex: 1
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a'
  },
  itemPrice: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: '#f97316'
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
    width: 26,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a'
  },
  footer: {
    marginTop: 12,
    gap: 8
  },
  totalText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a'
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    alignItems: 'center'
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#facc15'
  }
});

