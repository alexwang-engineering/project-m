import type { Metadata, Viewport } from 'next';
import { Inter, Manrope } from 'next/font/google';

import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Project M',
    template: '%s | Project M',
  },
  description: "Merchant Taylors' learning management system",
};

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#254889',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={`${manrope.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
