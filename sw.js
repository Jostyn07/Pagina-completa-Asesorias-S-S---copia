self.addEventListener('push', function (event) {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = { title: 'AsesoriasTH', body: event.data ? event.data.text() : '' };
    }

    const title = data.title || 'AsesoriasTH';
    const options = {
        body: data.body || '',
        icon: data.icon || '/images/Logo.png',
        badge: '/images/Logo.png',
        data: { url: data.url || '/' },
        tag: data.tag || undefined,
        renotify: !!data.tag
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (const client of windowClients) {
                if (client.url.includes(url) && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});