import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Serif, IBM_Plex_Mono } from 'next/font/google';

import './globals.css';

const plexSerif = IBM_Plex_Serif({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-plex-serif',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
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
  themeColor: '#9c4f43',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={`${plexSerif.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
