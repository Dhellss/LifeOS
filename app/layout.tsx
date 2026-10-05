import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

import { ThemeProvider } from '@/components/layout/theme-provider';
import { ToastProvider } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';

import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'LifeOS — Personal operating system',
    template: '%s · LifeOS',
  },
  description:
    'LifeOS is a personal operating system for tasks, projects, habits, study sessions, workouts, calendar events and journaling — with XP, achievements and real analytics.',
  applicationName: 'LifeOS',
  authors: [{ name: 'LifeOS' }],
  keywords: ['productivity', 'habits', 'tasks', 'projects', 'study tracker', 'personal dashboard'],
  openGraph: {
    title: 'LifeOS — Personal operating system',
    description:
      'Track tasks, projects, habits, study, fitness, events and journals in one private workspace.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f9fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0e121c' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-dvh font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={200}>
            <ToastProvider>{children}</ToastProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
