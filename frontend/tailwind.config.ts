import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /** Warm neutrals: existing `text-slate-*` / `border-slate-*` pick up stone (pairs with amber). */
        slate: colors.stone,
        primary: {
          DEFAULT: '#F9A31E',
          dark: '#1a1a1a',
          light: '#FBC04D',
        },
        accent: '#F9A31E',
        'accent-hover': '#E09218',
        surface: '#ffffff',
      },
      borderRadius: {
        card: '1rem',
        button: '0.75rem',
        pill: '9999px',
      },
      boxShadow: {
        soft: '0 2px 12px rgba(0,0,0,0.08)',
        'soft-lg': '0 4px 20px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
};
export default config;
