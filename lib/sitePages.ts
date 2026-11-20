// Pages of the main new.vote site (not inside a Society): the header shows
// their own title, and they get a Back link. Shared by server and browser.
export const SITE_PAGES: Record<string, string> = {
  '/features': 'Features', '/about': 'About', '/how-it-works': 'How debate works', '/privacy': 'Privacy',
  '/pricing': 'Pricing', '/blog': 'Newsletter', '/support': 'Support & Investors', '/contact': 'Contact',
  '/my-content': 'My content',
  '/guides': 'Guides', '/guides/admin': 'Admin guide', '/guides/member': 'Member guide', '/guides/guest': 'Guest guide',
};

export const siteTitle = (pathname: string): string | undefined =>
  SITE_PAGES[pathname] ?? (pathname.startsWith('/blog/') ? 'Newsletter' : pathname.startsWith('/s/') ? 'Shared document' : undefined);
