import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useNetwork } from '@contexts/NetworkContext';
import { tokens } from '@theme/tokens';

/** Full-screen gate when there is no usable network (matches web /offline intent). */
export function OfflineOverlay() {
  const { isOffline, recheck } = useNetwork();

  return (
    <Modal visible={isOffline} animationType="fade" statusBarTranslucent>
      <View style={styles.root}>
        <Text style={styles.icon}>📡</Text>
        <Text style={styles.title}>You are offline</Text>
        <Text style={styles.body}>
          VyBE needs an internet connection. Check your Wi‑Fi or mobile data, then try again.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={() => recheck()} accessibilityRole="button">
          <Text style={styles.btnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  icon: { fontSize: 48, marginBottom: 16 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: tokens.white,
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  btn: {
    backgroundColor: tokens.accent,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: tokens.radiusButton,
  },
  btnText: { color: tokens.white, fontSize: 16, fontWeight: '700' },
});
