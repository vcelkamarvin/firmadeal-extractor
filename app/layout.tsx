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
      <body className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
