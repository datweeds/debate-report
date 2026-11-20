// new.vote service worker: shows notifications and opens the right page when
// one is tapped. It doesn't cache anything, so the site always loads fresh.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'new.vote', {
    body: data.body || 'Something new in your Societies',
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    tag: data.tag || 'new.vote',
    renotify: true,
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Reuse an open new.vote tab: go to the page and bring it forward
    for (const tab of tabs) {
      if (new URL(tab.url).origin === self.location.origin && 'focus' in tab) {
        await tab.focus();
        if ('navigate' in tab) return tab.navigate(url).catch(() => self.clients.openWindow(url));
        return;
      }
    }
    return self.clients.openWindow(url);
  })());
});
