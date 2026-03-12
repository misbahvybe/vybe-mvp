import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export function PrivacyScreen() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>&lt; Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
      </View>
      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={styles.sectionTitle}>Data we collect</Text>
        <Text style={styles.text}>
          We store your basic profile, orders, delivery addresses and payment references as required
          to operate the service.
        </Text>
        <Text style={styles.sectionTitle}>How we use data</Text>
        <Text style={styles.text}>
          Data is used to process orders, show nearby stores, route riders, and calculate payouts.
          We do not sell your personal data.
        </Text>
        <Text style={styles.sectionTitle}>Third-party providers</Text>
        <Text style={styles.text}>
          Payment and mapping providers (such as XPay or map APIs) may process your data under their
          own policies when you use those features.
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

