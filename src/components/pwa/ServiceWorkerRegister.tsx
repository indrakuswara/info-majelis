"use client";

// Registrasi service worker PWA (plan Task 14; spec §12). Dipasang hanya
// di kerangka publik (SiteChrome) sehingga area /admin tidak pernah
// mendaftarkan service worker; service worker sendiri juga mem-bypass
// seluruh /admin. Registrasi hanya di production — di dev, cache service
// worker justru mengganggu hot reload.

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Gagal registrasi tidak fatal: situs tetap berfungsi penuh
        // sebagai web biasa.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
