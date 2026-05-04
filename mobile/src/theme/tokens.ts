/** Mirrors frontend/tailwind.config.ts */
export const tokens = {
  primary: '#F9A31E',
  primaryDark: '#1a1a1a',
  primaryLight: '#FBC04D',
  accent: '#F9A31E',
  accentHover: '#E09218',
  surface: '#ffffff',
  /** Warm neutrals (Tailwind stone) — names kept for fewer RN code changes */
  slate50: '#fafaf9',
  slate100: '#f5f5f4',
  slate200: '#e7e5e4',
  slate300: '#d6d3d1',
  slate400: '#a8a29e',
  slate500: '#78716c',
  slate600: '#57534e',
  slate700: '#44403c',
  slate800: '#292524',
  white: '#ffffff',
  white80: 'rgba(255,255,255,0.8)',
  radiusCard: 16,
  radiusButton: 12,
  radiusPill: 9999,
  shadowSoft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3
  },
  tabBarHeight: 64
} as const;
