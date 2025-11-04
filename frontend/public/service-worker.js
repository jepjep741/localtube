const CACHE_NAME = 'localtube-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Cache strategies
  if (url.pathname.startsWith('/thumbnails/')) {
    // Cache thumbnails for 30 days
    event.respondWith(cacheFirst(request, 30 * 24 * 60 * 60 * 1000));
  } else if (url.pathname.startsWith('/api/')) {
    // Network first for API calls, fallback to cache
    event.respondWith(networkFirst(request));
  } else if (request.destination === 'image') {
    // Cache other images for 7 days
    event.respondWith(cacheFirst(request, 7 * 24 * 60 * 60 * 1000));
  } else {
    // Network first for everything else
    event.respondWith(networkFirst(request));
  }
});

// Cache first strategy
async function cacheFirst(request, maxAge) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  if (cached) {
    const cachedDate = new Date(cached.headers.get('date'));
    const now = new Date();
    const age = now - cachedDate;
    
    if (age < maxAge) {
      return cached;
    }
  }
  
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return cached || new Response('Offline', { status: 503 });
  }
}

// Network first strategy
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      );
    })
  );
});