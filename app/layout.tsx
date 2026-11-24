import type { Metadata } from 'next';
import AgeCheckBanner from '@/components/AgeCheckBanner';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/components/AuthProvider';
import SiteBack from '@/components/SiteBack';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://new.vote'),
  title: {
    default: 'new.vote — One place for your community',
    template: '%s | new.vote',
  },
  description:
    'Discussions, documents, events and video calls for your group, with polls, projects and debates when you need them. Free to start.',
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' },
  // Installable as an app (needed for notifications on iPhone and iPad)
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'new.vote', statusBarStyle: 'black-translucent' },
  openGraph: {
    title: 'new.vote — One place for your community',
    description: 'Discussions, documents, events and video calls for your group, with polls, projects and debates when you need them. Free to start.',
    siteName: 'new.vote',
    url: 'https://new.vote',
    type: 'website',
    locale: 'en_GB',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'A group of people sitting in a circle on the grass, talking' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-image.jpg'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Set theme before React hydrates to avoid flash */}
        {/* Service worker: notifications only (it caches nothing) */}
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}` }} />
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('dr_theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');if(localStorage.getItem('dr_menu_pinned')==='1')document.documentElement.setAttribute('data-menu-pinned','');}catch(e){}` }} />
      </head>
      <body className="min-h-screen flex flex-col antialiased bg-dr-base">
        <ThemeProvider>
          <AuthProvider>
            <Header />
            <main className="dr-pin-main flex-1 pt-16 pb-14 sm:pb-0"><AgeCheckBanner /><SiteBack />{children}</main>
            <Footer />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
