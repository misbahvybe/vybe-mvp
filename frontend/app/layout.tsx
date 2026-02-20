import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthListener } from '@/components/auth/AuthListener';

export const metadata: Metadata = {
  title: 'Vybe – Delivery Platform',
  description: 'Order, deliver, partner. Lahore-based multi-role delivery.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#1e3a5f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <AuthListener />
        {children}
      </body>
    </html>
  );
}
