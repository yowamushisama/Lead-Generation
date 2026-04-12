import type { Metadata } from 'next';
import { Syne, IBM_Plex_Mono, DM_Sans } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/lib/query-client';

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-syne',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Obsidian — AI Acquisition Engine',
    template: '%s · Obsidian',
  },
  description: 'AI Intent-Based Client Acquisition Engine — discover, score, and convert high-intent B2B leads.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${ibmPlexMono.variable} ${dmSans.variable} h-full`}
    >
      <body className="min-h-full bg-base text-ink antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
