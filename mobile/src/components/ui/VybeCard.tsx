import React from 'react';
import { View, StyleSheet, type ViewProps } from 'react-native';
import { tokens } from '@theme/tokens';

interface VybeCardProps extends ViewProps {
  children: React.ReactNode;
  padding?: 'default' | 'none';
}

export function VybeCard({ children, style, padding = 'default', ...rest }: VybeCardProps) {
  return (
    <View
      style={[
        styles.card,
        padding === 'default' && styles.padded,
        tokens.shadowSoft,
        style
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.surface,
    borderRadius: tokens.radiusCard,
    borderWidth: 1,
    borderColor: tokens.slate200
  },
  padded: {
    padding: 16
  }
});
