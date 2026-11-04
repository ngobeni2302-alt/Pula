// One-time cleanup of the legacy NetworkFirst API cache on SW activation.
self.addEventListener('activate', event => {
  event.waitUntil(caches.delete('api-cache'));
});
