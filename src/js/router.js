/**
 * Simple Client-Side Router
 * Handles tab/page switching with history API support
 */

const AppRouter = {
  // Current route
  currentRoute: 'home',
  isNavigating: false,

  // Route definitions
  routes: {
    home: { tabId: 'main-content', title: 'Dashboard' },
    tahfizh: { tabId: 'tab-tahfizh', title: 'Tahfizh' },
    report: { tabId: 'tab-report', title: 'Laporan' },
    notifications: { tabId: 'tab-notifications', title: 'Notifikasi' },
    profile: { tabId: 'tab-profile', title: 'Profil' },
    admin: { tabId: 'tab-admin', title: 'Pengelolaan' }
  },

  /**
   * Initialize router
   */
  init() {
    // Handle browser back/forward
    window.addEventListener('popstate', (e) => {
      const route = e.state?.route || 'home';
      this.navigateTo(route, false);
    });

    // Handle initial route from URL
    const hash = window.location.hash.slice(1);
    if (hash && this.routes[hash]) {
      this.navigateTo(hash, false);
    }
  },

  /**
   * Navigate to a route
   * @param {string} route - Route name
   * @param {boolean} pushState - Whether to add to history
   */
  navigateTo(route, pushState = true) {
    if (!this.routes[route]) {
      console.warn(`[Router] Unknown route: ${route}`);
      return;
    }

    this.currentRoute = route;

    // Update URL
    const title = `${this.routes[route].title} - Syamsa`;
    if (pushState) {
      history.pushState({ route }, title, `#${route}`);
    }

    // Update document title
    document.title = title;

    // Switch to the appropriate tab
    if (typeof window.switchTab === 'function') {
      this.isNavigating = true;
      try {
        window.switchTab(route);
      } finally {
        this.isNavigating = false;
      }
    }

    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('routechange', { detail: { route } }));
  },

  /**
   * Get current route
   */
  getCurrentRoute() {
    return this.currentRoute;
  },

  /**
   * Check if route is active
   * @param {string} route - Route to check
   */
  isActive(route) {
    return this.currentRoute === route;
  }
};

// Export for global use
window.AppRouter = AppRouter;
