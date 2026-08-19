import { registerSW } from "virtual:pwa-register";

/**
 * Keep an installed Artium on the current build.
 *
 * registerType is "autoUpdate", so a new service worker installs and activates
 * by itself — but a page that is already open keeps the assets it loaded until
 * something reloads it. On a phone the app can sit in the switcher for days, so
 * that reload never happens on its own and the user keeps running whatever
 * build they first cached. That is exactly how three correct deploys in a row
 * came out looking identical on a real device while the served files were fine.
 */
const HOUR = 60 * 60 * 1000;

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    const check = () => {
      if (document.visibilityState === "visible") registration.update();
    };
    // Coming back to the app is the moment a stale build matters, so check
    // then as well as on a timer — an installed PWA may never be "opened"
    // again in the sense a browser tab is.
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    setInterval(check, HOUR);
  },
});

// A controller change means the cached assets just changed underneath us.
// Reload once so the running page stops mixing old JS with new CSS.
if ("serviceWorker" in navigator) {
  // On a first-ever visit there is no controller yet and one arrives normally;
  // reloading for that would bounce the page for no reason.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });
}

/**
 * Recover from a stale shell that points at chunks which no longer exist.
 *
 * This is the failure the domain move surfaced. A page cached before a deploy
 * keeps its index.html, and that file names the hashed chunks it was built
 * with. Deploy again and those files are gone. Nothing breaks until the user
 * reaches a screen whose code is lazily loaded — then the import 404s, the
 * Suspense above it never resolves, and they get a page with a hole in it.
 * The globe vanished exactly this way, on a screen where everything else drew
 * perfectly, which is what made it look like a rendering bug rather than a
 * missing file.
 *
 * The worker does heal itself, on the next visibility change or inside the
 * hour. This closes the window in between: a failed import becomes a reload
 * instead of a feature that is quietly absent.
 *
 * Once per tab, tracked in sessionStorage. If the chunk is missing because the
 * deploy itself is broken rather than stale, reloading will not fix it, and a
 * page that reloads forever is worse than one that renders badly.
 */
const TRIED = "artium_stale_chunk_reload";

/**
 * Clear the caches and the worker, then reload — once per tab.
 *
 * Exported because two different failures share this cure. A missing chunk
 * (the listeners below) and a render crash inside a cached build (the error
 * boundary) are both, most of the time, the same event: the service worker
 * is serving a page from before the last deploy. The reload button on an
 * error screen cannot fix that — the worker answers the reload with the same
 * cached copy — so recovery has to burn the cache first.
 *
 * Returns whether it acted. Once per tab, tracked in sessionStorage: if the
 * fresh build ALSO crashes, the deploy itself is broken, and a page that
 * reloads forever is worse than an error screen someone can read.
 */
export async function recoverStaleBuild(why) {
  if (!import.meta.env.PROD) return false;
  if (sessionStorage.getItem(TRIED)) return false;
  sessionStorage.setItem(TRIED, why);
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    // Recovery is best-effort; a reload without it still beats a hole.
  }
  window.location.reload();
  return true;
}

if (import.meta.env.PROD) {
  const reloadOnce = recoverStaleBuild;

  // Vite's own signal, raised when a lazily-imported chunk fails to load.
  window.addEventListener("vite:preloadError", () => reloadOnce("preload"));

  // The same failure arriving as a rejected import(), which is what an
  // already-running page sees when it reaches for a chunk mid-session.
  window.addEventListener("unhandledrejection", (e) => {
    const msg = String(e?.reason?.message || e?.reason || "");
    if (/dynamically imported module|Importing a module script failed|error loading dynamically imported/i.test(msg)) {
      reloadOnce("import");
    }
  });
}
