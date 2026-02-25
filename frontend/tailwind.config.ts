import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7c3aed',
          dark: '#1a1a1a',
          light: '#8b5cf6',
        },
        accent: '#7c3aed',
        'accent-hover': '#6d28d9',
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
