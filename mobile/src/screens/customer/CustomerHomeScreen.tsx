import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@store/auth';

const CATEGORY_CARDS = [
  { id: 'food', label: 'Food' },
  { id: 'grocery', label: 'Grocery' },
  { id: 'medicine', label: 'Medicine' },
  { id: 'ride', label: 'Ride', comingSoon: true },
  { id: 'courier', label: 'Courier', comingSoon: true },
  { id: 'wallet', label: 'Crypto Wallet' }
];

export function CustomerHomeScreen() {
  const user = useAuthStore((s) => s.user);
  const navigation = useNavigation<any>();
  const firstName = user?.name?.split(' ')[0] ?? user?.name ?? 'Customer';

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.appTitle}>VYBE</Text>
        <Text style={styles.title}>Hi, {firstName}</Text>
        <Text style={styles.subtitle}>What would you like to order today?</Text>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <TouchableOpacity onPress={() => navigation.navigate('CustomerStores')}>
            <Text style={styles.link}>All stores</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          {CATEGORY_CARDS.map((cat) => {
            const comingSoon = !!cat.comingSoon;
            const onPress = () => {
              if (comingSoon) return;
              if (cat.id === 'wallet') {
                navigation.navigate('CustomerStores');
                return;
              }
              navigation.navigate('CustomerCategory', {
                type: cat.id,
                title: cat.label
              });
            };
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.card, comingSoon && styles.cardDisabled]}
                disabled={comingSoon}
                onPress={onPress}
              >
                <Text style={styles.cardLabel}>{cat.label}</Text>
                {comingSoon && <Text style={styles.badge}>Coming soon</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  scroll: {
    paddingTop: 32,
    paddingHorizontal: 16,
    paddingBottom: 32
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#020617',
    marginBottom: 16
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a'
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 20
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b'
  },
  link: {
    fontSize: 13,
    color: '#f97316',
    fontWeight: '500'
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  card: {
    width: '48%',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    paddingVertical: 20,
    paddingHorizontal: 12,
    shadowColor: '#020617',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  cardDisabled: {
    opacity: 0.5
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a'
  },
  badge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    color: '#475569',
    fontWeight: '500'
  }
});

