import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Firmadeal - Institutional Data Extraction',
  description: 'Extract business intelligence from Google Maps for valuation modeling',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
