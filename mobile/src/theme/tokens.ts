/** Mirrors frontend/tailwind.config.ts */
export const tokens = {
  primary: '#7c3aed',
  primaryDark: '#1a1a1a',
  primaryLight: '#8b5cf6',
  accent: '#7c3aed',
  accentHover: '#6d28d9',
  surface: '#ffffff',
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
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
