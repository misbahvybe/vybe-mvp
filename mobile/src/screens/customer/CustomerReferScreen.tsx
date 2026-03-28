import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CustomerScreenShell } from '@components/customer/CustomerScreenShell';
import { tokens } from '@theme/tokens';

export function CustomerReferScreen() {
  const navigation = useNavigation<any>();
  return (
    <CustomerScreenShell
      title="Refer friends"
      showBack
      onBack={() => navigation.goBack()}
      bottomPadding="nav"
    >
      <View style={styles.pad}>
        <Text style={styles.body}>
          Referral rewards and sharing links are coming soon. Check the web app for updates.
        </Text>
      </View>
    </CustomerScreenShell>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingTop: 16 },
  body: { fontSize: 15, color: tokens.slate600, lineHeight: 22 }
});
