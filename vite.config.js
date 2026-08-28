import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Registration lives in src/pwa.js, which also forces the reload that
      // autoUpdate on its own does not do for an already-open page.
      injectRegister: null,
      includeAssets: ["icon-512.png", "icon-192.png", "icon-512-maskable.png", "apple-touch-icon.png"],
      manifest: {
        name: "Artium — A World Connected by Music",
        short_name: "Artium",
        description: "Connect with conservatory musicians worldwide",
        theme_color: "#FFC629",
        background_color: "#FFC629",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          // Separate file on purpose: the ringed icon puts white at the very
          // edge, and Android crops maskable icons to its own shape, which
          // would slice the ring off. This one is full-bleed with no ring.
          {
            src: "icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        // Precache diet (2026-08-27): updates only activate after the whole
        // precache downloads, and with the hall photos, 41 instrument
        // drawings, the satellite texture and the hero art in it the bundle
        // hit ~12MB — long enough on mobile data that every deploy felt
        // "stuck" until the user cleared site data. The shell (js/css/html,
        // fonts, svg, small png marks) stays precached for instant offline
        // boot; the heavy imagery moved to runtimeCaching below — cached the
        // first time each image is actually seen, at the cost of needing one
        // network fetch before it's available offline.
        // webp, jpg and json were missing, and between them they are most of
        // what the app looks like: all 41 instrument drawings are webp, both
        // hall photographs are webp, the globe's satellite texture is jpg and
        // its country borders are json. None of it was ever cached, so an
        // installed app on a bad connection drew a bare sphere and rows with
        // broken-image marks where the instruments belong.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // The satellite texture alone is 1.4MB and the default ceiling is 2MB;
        // state it rather than leave the largest asset one edit away from
        // silently dropping out of the precache again.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // The imagery evicted from the precache: webp/jpg photos and the
            // globe's satellite texture + country-borders json. Cache-first
            // and effectively immutable (hashed or replaced wholesale).
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\.(webp|jpg|jpeg|json)$/i.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "artium-imagery",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/server\.arcgisonline\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "map-tiles",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    open: true,
  },
});
