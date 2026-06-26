/**
 * Modular app bootstrap.
 * Keeps the new loader/router foundation active while the legacy shell is migrated gradually.
 */
(function initModularApp() {
  function syncRouteFromLegacyTab(tabName) {
    if (!window.AppRouter?.routes?.[tabName] || window.AppRouter.isNavigating) return;
    const activeTab = tabName === "home"
      ? document.getElementById("main-content")
      : document.getElementById(`tab-${tabName}`);

    if (activeTab?.classList.contains("hidden")) return;

    const route = window.AppRouter.routes[tabName];
    const title = `${route.title} - Syamsa`;
    window.AppRouter.currentRoute = tabName;
    document.title = title;

    if (window.location.hash.slice(1) !== tabName) {
      history.pushState({ route: tabName }, title, `#${tabName}`);
    }

    window.dispatchEvent(new CustomEvent("routechange", { detail: { route: tabName } }));
  }

  function bridgeLegacyNavigation() {
    if (typeof window.switchTab !== "function" || window.switchTab.__routerBridge) return;

    const originalSwitchTab = window.switchTab;
    window.switchTab = function bridgedSwitchTab(tabName, ...args) {
      const result = originalSwitchTab.call(this, tabName, ...args);
      syncRouteFromLegacyTab(tabName);
      return result;
    };
    window.switchTab.__routerBridge = true;
  }

  function start() {
    window.ComponentLoader?.preloadCritical?.();
    window.ComponentLoader?.ensureCriticalLayouts?.();
    window.ComponentLoader?.ensureCriticalTemplates?.();
    window.ComponentLoader?.ensureCriticalModals?.();
    bridgeLegacyNavigation();
    window.AppRouter?.init?.();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
