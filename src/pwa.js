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
