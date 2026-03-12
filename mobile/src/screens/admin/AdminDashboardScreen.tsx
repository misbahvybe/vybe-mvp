import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '@store/auth';

export function AdminDashboardScreen() {
  const user = useAuthStore((s) => s.user);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Admin Dashboard</Text>
      <Text style={styles.subtitle}>Welcome, {user?.name ?? 'Admin'}!</Text>
      <Text style={styles.body}>
        Here we will reflect key admin views from the web app: finance, orders, riders, stores and
        withdraw management.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: 48,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc'
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16
  },
  body: {
    fontSize: 14,
    color: '#475569'
  }
});

