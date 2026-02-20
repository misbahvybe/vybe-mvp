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
          DEFAULT: '#1e3a5f',
          dark: '#152a45',
          light: '#2d4a6f',
        },
        accent: '#f97316',
        'accent-hover': '#ea580c',
        surface: '#f8fafc', /* same as --background for content panels */
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
