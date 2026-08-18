import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import SubNav from '@/components/SubNav';
import Footer from '@/components/Footer';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/components/AuthProvider';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://new.vote'),
  title: {
    default: 'new.vote — Democracy Tools for Society',
    template: '%s | new.vote',
  },
  description:
    'Structured debate, democratic proposals, and civic tools. Evidence-based. Open to all.',
  icons: { icon: '/favicon.svg', apple: '/favicon.svg' },
  openGraph: {
    title: 'new.vote — Democracy Tools for Society',
    description: 'Structured debate, democratic proposals, and civic tools. Evidence-based. Open to all.',
    siteName: 'new.vote',
    url: 'https://new.vote',
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
          <AuthProvider>
            <Header />
            <SubNav />
            <main className="flex-1 pt-[108px] pb-16 sm:pb-0">{children}</main>
            <Footer />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
