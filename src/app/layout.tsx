import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rentagun Concierge Bot',
  description: 'AI-powered assistant for Rentagun - Try before you buy firearms rental',
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
