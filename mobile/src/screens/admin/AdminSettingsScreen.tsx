import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { PartnerScreenShell } from '@components/partner/PartnerScreenShell';
import { tokens } from '@theme/tokens';

export function AdminSettingsScreen() {
  const navigation = useNavigation<any>();
  return (
    <PartnerScreenShell
      title="Settings"
      showBack
      onBack={() => navigation.goBack()}
      bottomPadding="nav"
    >
      <View style={styles.pad}>
        <Text style={styles.body}>
          Advanced admin settings match the web app under Admin → Settings. Use the web dashboard
          for OTP templates, feature flags, and platform configuration.
        </Text>
      </View>
    </PartnerScreenShell>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingTop: 16 },
  body: { fontSize: 15, color: tokens.slate600, lineHeight: 22 },
});
