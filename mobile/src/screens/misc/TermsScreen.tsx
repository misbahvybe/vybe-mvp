import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export function TermsScreen() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>&lt; Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
      </View>
      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={styles.sectionTitle}>Use of the app</Text>
        <Text style={styles.text}>
          By creating an account or placing an order, you agree to use this app only for lawful
          purposes. Orders, payouts and deliveries are subject to local regulations and our
          platform policies.
        </Text>
        <Text style={styles.sectionTitle}>Accounts & roles</Text>
        <Text style={styles.text}>
          Customer, store, rider and admin accounts are role-based. You are responsible for keeping
          your login details and device secure.
        </Text>
        <Text style={styles.sectionTitle}>Payments & fees</Text>
        <Text style={styles.text}>
          Orders may include delivery, service and platform fees. For non-cash payments, third
          party providers (e.g. XPay) process transactions under their own terms.
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 8,
    marginBottom: 4,
  },
  text: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 8,
  },
});

