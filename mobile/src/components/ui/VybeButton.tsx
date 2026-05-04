import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  type TouchableOpacityProps
} from 'react-native';
import { tokens } from '@theme/tokens';

type Variant = 'primary' | 'accent' | 'outline';

interface VybeButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: Variant;
  size?: 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

export function VybeButton({
  title,
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading,
  disabled,
  style,
  ...rest
}: VybeButtonProps) {
  const v = variantStyles[variant];
  const s = size === 'lg' ? styles.lg : styles.md;
  return (
    <TouchableOpacity
      style={[
        styles.base,
        v.container,
        s,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled
      ]}
      disabled={disabled || loading}
      activeOpacity={0.9}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.spinnerColor} />
      ) : (
        <Text style={[styles.label, v.label]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const variantStyles = {
  primary: {
    container: { backgroundColor: tokens.primary },
    label: { color: tokens.white },
    spinnerColor: tokens.white as string
  },
  accent: {
    container: { backgroundColor: tokens.accent },
    label: { color: tokens.white },
    spinnerColor: tokens.white as string
  },
  outline: {
    container: {
      backgroundColor: tokens.primary
    },
    label: { color: tokens.white },
    spinnerColor: tokens.white as string
  }
};

const styles = StyleSheet.create({
  base: {
    borderRadius: tokens.radiusButton,
    alignItems: 'center',
    justifyContent: 'center'
  },
  md: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    minHeight: 44
  },
  lg: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    minHeight: 48
  },
  fullWidth: {
    alignSelf: 'stretch'
  },
  label: {
    fontSize: 16,
    fontWeight: '600'
  },
  disabled: {
    opacity: 0.55
  }
});
