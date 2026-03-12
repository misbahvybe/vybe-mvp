import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export function OnboardingScreen() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.logo}>Vybe</Text>
        <Text style={styles.title}>All your orders, one super app</Text>
        <Text style={styles.subtitle}>
          Customers order, stores manage menus, riders deliver, admins control finances – all in
          one place.
        </Text>

        <View style={styles.carousel}>
          <View style={styles.slide}>
            <Text style={styles.slideTitle}>For customers</Text>
            <Text style={styles.slideText}>
              Browse nearby stores, add to cart, pay with cash or XPay, and track your orders.
            </Text>
          </View>
          <View style={styles.slide}>
            <Text style={styles.slideTitle}>For stores</Text>
            <Text style={styles.slideText}>
              Receive orders in real time, manage products & availability, and track earnings.
            </Text>
          </View>
          <View style={styles.slide}>
            <Text style={styles.slideTitle}>For riders & admins</Text>
            <Text style={styles.slideText}>
              Riders get assigned orders and earnings; admins control payouts, riders and stores.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.primaryButtonText}>Continue to login</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Signup')}
        >
          <Text style={styles.secondaryButtonText}>Create a customer account</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate('Help')}>
          <Text style={styles.linkText}>Need help? Learn more</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020617',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
  },
  logo: {
    fontSize: 26,
    fontWeight: '800',
    color: '#facc15',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 24,
  },
  carousel: {
    borderRadius: 24,
    backgroundColor: '#0b1120',
    padding: 16,
    gap: 12,
    marginBottom: 24,
  },
  slide: {
    padding: 8,
    borderRadius: 12,
  },
  slideTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 4,
  },
  slideText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: '#facc15',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#020617',
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#475569',
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 4,
  },
  linkText: {
    fontSize: 13,
    color: '#9ca3af',
    textDecorationLine: 'underline',
  },
});

