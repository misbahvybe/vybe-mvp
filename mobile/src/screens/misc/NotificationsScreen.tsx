import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promotions, setPromotions] = useState(false);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>&lt; Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>
      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.row}>
          <View>
            <Text style={styles.rowTitle}>Order updates</Text>
            <Text style={styles.rowText}>Alerts about new orders, status changes and payouts.</Text>
          </View>
          <Switch
            value={orderUpdates}
            onValueChange={setOrderUpdates}
            trackColor={{ false: '#cbd5e1', true: '#22c55e' }}
            thumbColor="#ffffff"
          />
        </View>
        <View style={styles.row}>
          <View>
            <Text style={styles.rowTitle}>Promotions</Text>
            <Text style={styles.rowText}>Occasional offers, discounts and feature updates.</Text>
          </View>
          <Switch
            value={promotions}
            onValueChange={setPromotions}
            trackColor={{ false: '#cbd5e1', true: '#22c55e' }}
            thumbColor="#ffffff"
          />
        </View>
        <Text style={styles.hint}>
          System-level notification permissions are managed from your device settings. These
          toggles control what Vybe will attempt to send.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
    borderBottomColor: '#e2e8f0',
  },
  back: {
    color: '#0ea5e9',
    fontSize: 14,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  rowText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    maxWidth: 220,
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 16,
  },
});

