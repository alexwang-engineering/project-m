import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Manrope } from 'next/font/google';

import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
  weight: ['700', '800'],
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
  themeColor: '#182c4d',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-GB"
      className={`${geist.variable} ${geistMono.variable} ${manrope.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
