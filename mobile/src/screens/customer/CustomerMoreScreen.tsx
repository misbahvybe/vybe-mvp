import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@store/auth';

export function CustomerMoreScreen() {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {user && (
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.name?.charAt(0) ?? '?'}</Text>
            </View>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.phone}>{user.phone}</Text>
          </View>
        )}
        <View style={styles.menuCard}>
          <MenuItem
            label="Account Information"
            onPress={() => navigation.navigate('CustomerProfile')}
          />
          <MenuItem
            label="Delivery Addresses"
            onPress={() => navigation.navigate('CustomerAddresses')}
          />
          <MenuItem
            label="Wallet"
            onPress={() => navigation.navigate('CustomerWallet')}
          />
          <MenuItem
            label="Payment Methods"
            onPress={() => navigation.navigate('CustomerPaymentMethods')}
          />
          <MenuItem
            label="My Orders"
            onPress={() => navigation.navigate('CustomerOrders')}
          />
        </View>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => {
            logout();
          }}
        >
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function MenuItem({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.menuChevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0'
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  profileCard: {
    alignItems: 'center',
    marginBottom: 16
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#facc15' },
  name: { marginTop: 8, fontSize: 16, fontWeight: '600', color: '#0f172a' },
  phone: { marginTop: 2, fontSize: 13, color: '#64748b' },
  menuCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    paddingVertical: 4,
    marginTop: 12,
    shadowColor: '#020617',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb'
  },
  menuLabel: { fontSize: 14, color: '#0f172a', fontWeight: '500' },
  menuChevron: { fontSize: 16, color: '#cbd5e1' },
  logoutButton: {
    marginTop: 24,
    borderRadius: 999,
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    alignItems: 'center'
  },
  logoutText: { fontSize: 14, fontWeight: '600', color: '#facc15' }
});

