import type { Metadata, Viewport } from 'next';

import './globals.css';

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
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
