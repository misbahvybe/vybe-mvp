import { tokens } from '@theme/tokens';

/** Shared bottom tab styling for store / rider / admin (matches CustomerTabs). */
export function getPartnerTabScreenOptions(bottomInset: number) {
  const bottomPad = Math.max(bottomInset, 10);
  return {
    headerShown: false as const,
    tabBarActiveTintColor: tokens.accent,
    tabBarInactiveTintColor: 'rgba(255,255,255,0.8)' as const,
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: '600' as const,
      marginBottom: 4
    },
    tabBarStyle: {
      backgroundColor: tokens.primaryDark,
      borderTopWidth: 0,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      minHeight: 56 + bottomPad,
      height: 56 + bottomPad,
      paddingBottom: bottomPad,
      paddingTop: 6,
      ...tokens.shadowSoft
    }
  };
}
