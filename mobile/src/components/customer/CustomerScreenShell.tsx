import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  type ViewStyle
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@theme/tokens';

type BottomPadding = 'nav' | 'sm' | 'none';

const bottomPad = (mode: BottomPadding, insetBottom: number) => {
  const base = insetBottom + 8;
  if (mode === 'nav') return 20 + base;
  if (mode === 'sm') return 16 + base;
  return 12 + base;
};

interface CustomerScreenShellProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  bottomPadding?: BottomPadding;
  /** When false, render children inside flex panel only (use for FlatList screens) */
  scrollable?: boolean;
  contentContainerStyle?: ViewStyle;
  children: React.ReactNode;
}

export function CustomerScreenShell({
  title,
  showBack = false,
  onBack,
  rightAction,
  bottomPadding = 'nav',
  scrollable = true,
  contentContainerStyle,
  children
}: CustomerScreenShellProps) {
  const insets = useSafeAreaInsets();
  const isBrand = !showBack && title === 'VYBE Superapp';
  const pb = bottomPad(bottomPadding, insets.bottom);

  return (
    <View style={[styles.root, { backgroundColor: tokens.primaryDark }]}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerSide}>
          {showBack ? (
            <TouchableOpacity
              onPress={onBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Text
          style={[styles.headerTitle, isBrand && styles.headerTitleBrand]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <View style={styles.headerRight}>{rightAction}</View>
      </View>

      <View
        style={[
          styles.panel,
          {
            paddingBottom: pb,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24
          }
        ]}
      >
        {scrollable ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[{ paddingBottom: 8 }, contentContainerStyle]}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, contentContainerStyle]}>{children}</View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 16
  },
  headerSide: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center'
  },
  backBtn: {
    padding: 8,
    marginLeft: -8
  },
  backText: {
    color: tokens.white,
    fontSize: 20
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: tokens.white,
    fontSize: 18,
    fontWeight: '700'
  },
  headerTitleBrand: {
    fontSize: 20,
    letterSpacing: -0.5
  },
  headerRight: {
    minWidth: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4
  },
  panel: {
    flex: 1,
    backgroundColor: tokens.surface,
    overflow: 'hidden'
  }
});
