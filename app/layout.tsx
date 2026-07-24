import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ThemeProvider } from '@/components/ThemeProvider';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://debate.report'),
  title: {
    default: 'debate.report — Structured Online Debate',
    template: '%s | debate.report',
  },
  description:
    'An online platform for structured, moderated debate on the issues that matter. Arguments presented visually — pros, cons, evidence — so you can reach a reasoned position.',
  icons: { icon: '/favicon.svg', apple: '/favicon.svg' },
  openGraph: {
    title: 'debate.report — Structured Online Debate',
    description: 'Structured, moderated debate on the important issues of today. Evidence-based. Strictly moderated. Open to all.',
    siteName: 'debate.report',
    url: 'https://debate.report',
    type: 'website',
    locale: 'en_GB',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Set theme before React hydrates to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('dr_theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){}` }} />
      </head>
      <body className="min-h-screen flex flex-col antialiased bg-dr-base">
        <ThemeProvider>
          <Header />
          <main className="flex-1 pt-16">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
