import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CustomerScreenShell } from '@components/customer/CustomerScreenShell';
import { tokens } from '@theme/tokens';

export function CustomerMorePasswordScreen() {
  const navigation = useNavigation<any>();
  return (
    <CustomerScreenShell
      title="Password"
      showBack
      onBack={() => navigation.goBack()}
      bottomPadding="nav"
    >
      <View style={styles.pad}>
        <Text style={styles.body}>
          Change your password from the web app under More → Password, or contact support.
        </Text>
      </View>
    </CustomerScreenShell>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingTop: 16 },
  body: { fontSize: 15, color: tokens.slate600, lineHeight: 22 }
});
