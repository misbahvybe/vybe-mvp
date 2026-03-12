import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export function HelpScreen() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>&lt; Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
      </View>
      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={styles.sectionTitle}>Getting started</Text>
        <Text style={styles.text}>
          Customers can browse stores, add items to cart, and place orders with cash or XPay. Store
          owners receive orders and manage products. Riders deliver and track their earnings. Admins
          oversee payouts and operations.
        </Text>

        <Text style={styles.sectionTitle}>Contact support</Text>
        <Text style={styles.text}>If you need help, reach us at:</Text>
        <TouchableOpacity
          onPress={() => Linking.openURL('mailto:support@vybe.pk')}
          style={styles.linkRow}
        >
          <Text style={styles.link}>support@vybe.pk</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Terms')}
          style={styles.linkRow}
        >
          <Text style={styles.link}>View Terms of Service</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('Privacy')}
          style={styles.linkRow}
        >
          <Text style={styles.link}>View Privacy Policy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications')}
          style={styles.linkRow}
        >
          <Text style={styles.link}>Notification settings</Text>
        </TouchableOpacity>
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
  linkRow: {
    marginTop: 4,
  },
  link: {
    fontSize: 13,
    color: '#0ea5e9',
  },
});

