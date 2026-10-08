/* Service worker Info Majelis (plan Task 14; spec §12).
 *
 * Prinsip: data jadwal harus selalu segar, jadi halaman & data selalu
 * network-first; cache hanya jaring pengaman offline dan untuk aset
 * statis/gambar. Area /admin di-bypass penuh — tidak pernah di-cache,
 * tidak pernah dilayani dari cache.
 *
 * Ganti VERSION setiap kali strategi/daftar precache berubah agar
 * cache lama dibersihkan saat activate.
 */
const VERSION = "v1";
const STATIC_CACHE = `info-majelis-static-${VERSION}`;
const PAGES_CACHE = `info-majelis-pages-${VERSION}`;
const IMAGES_CACHE = `info-majelis-images-${VERSION}`;
const KNOWN_CACHES = [STATIC_CACHE, PAGES_CACHE, IMAGES_CACHE];

const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  "/",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // Satu per satu: satu URL gagal tidak menggagalkan precache lain.
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("info-majelis-") && !KNOWN_CACHES.includes(key),
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Network-first untuk halaman/data: respons jaringan selalu didahulukan
 *  (jadwal segar); salinan terakhir yang berhasil disimpan sebagai
 *  fallback saat jaringan gagal total. */
async function networkFirst(request, { navigation = false } = {}) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached =
      (await cache.match(request)) ||
      (await cache.match(request, { ignoreSearch: true }));
    if (cached) return cached;
    if (navigation) {
      const offline = await caches.match(OFFLINE_URL);
      if (offline) return offline;
    }
    throw error;
  }
}

/** Cache-first untuk aset statis berversi/hash (JS/CSS/font/ikon situs). */
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    cache.put(request, response.clone());
  }
  return response;
}

/** Cache-first + revalidasi di latar untuk gambar (poster /uploads,
 *  gambar /og, ikon): tampilan instan dari cache, salinan segar diambil
 *  di latar agar penggantian poster tetap terambil pada kunjungan
 *  berikutnya. */
async function cacheFirstRevalidate(request) {
  const cache = await caches.open(IMAGES_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok || response.type === "opaque") {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  if (cached) return cached;
  const response = await network;
  if (response) return response;
  return new Response("", { status: 504, statusText: "Offline" });
}

function isStaticAsset(url, request) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    ["style", "script", "font", "worker"].includes(request.destination)
  );
}

function isImage(url, request) {
  return (
    request.destination === "image" ||
    url.pathname.startsWith("/uploads/") ||
    url.pathname.startsWith("/og/")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Area admin: bypass penuh — service worker tidak ikut campur sama
  // sekali (tidak di-cache, tidak dilayani dari cache).
  if (url.pathname.startsWith("/admin")) return;

  if (url.origin !== self.location.origin) {
    // Lintas origin: hanya gambar (mis. poster Vercel Blob) yang di-cache.
    if (request.destination === "image") {
      event.respondWith(cacheFirstRevalidate(request));
    }
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, { navigation: true }));
    return;
  }
  if (isImage(url, request)) {
    event.respondWith(cacheFirstRevalidate(request));
    return;
  }
  if (isStaticAsset(url, request)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  // GET seorigin lain (mis. payload RSC): network-first agar data
  // jadwal selalu segar, fallback ke salinan terakhir saat offline.
  event.respondWith(networkFirst(request));
});
