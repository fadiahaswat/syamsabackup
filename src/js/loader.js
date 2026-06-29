/**
 * Component Loader - Dynamic HTML/Template Loader
 * Loads HTML fragments asynchronously and injects into DOM
 */

const ComponentLoader = {
  // Cache for loaded components
  cache: new Map(),
  isFileProtocol: window.location.protocol === 'file:',

  // Base path for components
  basePath: 'src/components',
  pagesPath: 'src/pages',
  templatesPath: 'src/templates',
  layoutsPath: 'src/layouts',

  /**
   * Resolve extracted component paths to inline DOM that still exists in index.html.
   * This keeps the app usable when opened directly through file://, where fetch()
   * cannot read neighboring HTML files because of browser CORS rules.
   */
  getInlineFallback(path) {
    const normalizedPath = path.replace(/\\/g, '/');
    const inlineNodes = {
      'src/layouts/bottom-nav.html': { id: 'bottom-nav', mode: 'outer' },
      'src/layouts/sidebar-desktop.html': { id: 'desktop-sidebar', mode: 'outer' },
      'src/pages/auth/onboarding.html': { id: 'view-onboarding', mode: 'outer' },
      'src/pages/auth/login.html': { id: 'view-login', mode: 'outer' },
      'src/pages/attendance/attendance.html': { id: 'view-attendance', mode: 'outer' },
      'src/pages/qibla/qibla.html': { id: 'view-qibla', mode: 'outer' },
      'src/pages/dashboard/dashboard.html': { id: 'main-content', mode: 'outer' },
      'src/pages/notifications/notifications.html': { id: 'tab-notifications', mode: 'outer' },
      'src/pages/report/report.html': { id: 'tab-report', mode: 'outer' },
      'src/pages/profile/profile.html': { id: 'tab-profile', mode: 'outer' },
      'src/pages/tahfizh/tahfizh.html': { id: 'tab-tahfizh', mode: 'outer' },
      'src/templates/slot-item.html': { id: 'tpl-slot-item', mode: 'template' },
      'src/templates/slot-item-wide.html': { id: 'tpl-slot-item-wide', mode: 'template' },
      'src/templates/santri-row.html': { id: 'tpl-santri-row', mode: 'template' },
      'src/templates/activity-btn.html': { id: 'tpl-activity-btn', mode: 'template' },
      'src/templates/tahfizh/jadwal-perpulangan.html': { id: 'tahfizh-tpl-jadwal-perpulangan', mode: 'template' },
      'src/templates/tahfizh/accordion-item.html': { id: 'tahfizh-tpl-accordion-item', mode: 'template' },
      'src/templates/tahfizh/peringkat-section.html': { id: 'tahfizh-tpl-peringkat-section', mode: 'template' },
      'src/templates/tahfizh/peringkat-item.html': { id: 'tahfizh-tpl-peringkat-item', mode: 'template' },
      'src/templates/tahfizh/tahfizh-section.html': { id: 'tahfizh-tpl-tahfizh-section', mode: 'template' },
      'src/templates/tahfizh/tahfizh-content.html': { id: 'tahfizh-tpl-tahfizh-content', mode: 'template' },
      'src/templates/tahfizh/history-row.html': { id: 'tahfizh-history-row-template', mode: 'template' },
      'src/templates/tahfizh/rekap-content.html': { id: 'tahfizh-rekap-content-template', mode: 'template' },
      'src/templates/tahfizh/rekap-row.html': { id: 'tahfizh-tpl-rekap-row', mode: 'template' },
      'src/templates/tahfizh/juz-block.html': { id: 'tahfizh-tpl-juz-block', mode: 'template' },
      'src/templates/tahfizh/analisis-prompt.html': { id: 'tahfizh-analisis-prompt-template', mode: 'template' },
      'src/templates/tahfizh/analisis-dashboard.html': { id: 'tahfizh-analisis-dashboard-template', mode: 'template' },
      'src/components/modals/modal-rekap.html': { id: 'modal-rekap', mode: 'outer' },
      'src/components/modals/modal-permit.html': { id: 'modal-permit', mode: 'outer' },
      'src/components/modals/modal-notification-settings.html': { id: 'modal-notification-settings', mode: 'outer' }
    };

    const fallback = inlineNodes[normalizedPath];
    if (!fallback) return '';

    const node = document.getElementById(fallback.id);
    if (!node) return '';

    return fallback.mode === 'template' ? node.innerHTML : node.outerHTML;
  },

  /**
   * Load HTML content from a file
   * @param {string} path - Relative path to the HTML file
   * @returns {Promise<string>} HTML content
   */
  async load(path) {
    if (this.cache.has(path)) {
      return this.cache.get(path);
    }

    const inlineHtml = this.getInlineFallback(path);
    if (inlineHtml) {
      this.cache.set(path, inlineHtml);
      return inlineHtml;
    }

    if (this.isFileProtocol) {
      return '';
    }

    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load ${path}: ${response.status}`);
      }
      const html = await response.text();
      this.cache.set(path, html);
      return html;
    } catch (error) {
      console.error(`[ComponentLoader] Error loading ${path}:`, error);
      return '';
    }
  },

  /**
   * Inject HTML into a target element
   * @param {string} targetId - ID of target element
   * @param {string} html - HTML content to inject
   * @param {Object} options - Options like append, prepend
   */
  inject(targetId, html, options = {}) {
    const target = document.getElementById(targetId);
    if (!target) {
      console.warn(`[ComponentLoader] Target #${targetId} not found`);
      return;
    }

    const { append = false, prepend = false, callback } = options;

    if (append) {
      target.insertAdjacentHTML('beforeend', html);
    } else if (prepend) {
      target.insertAdjacentHTML('afterbegin', html);
    } else {
      target.innerHTML = html;
    }

    // Re-initialize Lucide icons
    if (window.lucide) {
      lucide.createIcons();
    }

    if (callback) callback();
  },

  /**
   * Load and inject a component
   * @param {string} path - Path to component HTML
   * @param {string} targetId - Target element ID
   * @param {Object} options - Inject options
   */
  async mount(path, targetId, options = {}) {
    const html = await this.load(path);
    this.inject(targetId, html, options);
    return html;
  },

  /**
   * Load a page module
   * @param {string} pageName - Name of the page
   * @param {string} section - Section/subfolder
   */
  async loadPage(pageName, section = '') {
    const sectionPath = section ? `${section}/` : '';
    return this.load(`${this.pagesPath}/${sectionPath}${pageName}.html`);
  },

  /**
   * Load a component
   * @param {string} componentName - Name of the component
   * @param {string} folder - Subfolder
   */
  async loadComponent(componentName, folder = '') {
    const folderPath = folder ? `${folder}/` : '';
    return this.load(`${this.basePath}/${folderPath}${componentName}.html`);
  },

  /**
   * Load a template
   * @param {string} templateName - Name of the template
   */
  async loadTemplate(templateName) {
    return this.load(`${this.templatesPath}/${templateName}.html`);
  },

  /**
   * Ensure a <template> exists in the DOM, loading it from src/templates when missing.
   * @param {string} templateId - DOM template id, e.g. tpl-slot-item
   * @param {string} templateName - File name without .html
   */
  async ensureTemplate(templateId, templateName) {
    const existing = document.getElementById(templateId);
    if (existing) return existing;

    const html = await this.loadTemplate(templateName);
    if (!html) return null;

    const template = document.createElement('template');
    template.id = templateId;
    template.innerHTML = html.trim();
    document.body.appendChild(template);
    return template;
  },

  /**
   * Ensure templates still exist after they are removed from index.html.
   */
  async ensureCriticalTemplates() {
    const templates = [
      ['tpl-slot-item', 'slot-item'],
      ['tpl-slot-item-wide', 'slot-item-wide'],
      ['tpl-santri-row', 'santri-row'],
      ['tpl-activity-btn', 'activity-btn'],
      ['tahfizh-tpl-jadwal-perpulangan', 'tahfizh/jadwal-perpulangan'],
      ['tahfizh-tpl-accordion-item', 'tahfizh/accordion-item'],
      ['tahfizh-tpl-peringkat-section', 'tahfizh/peringkat-section'],
      ['tahfizh-tpl-peringkat-item', 'tahfizh/peringkat-item'],
      ['tahfizh-tpl-tahfizh-section', 'tahfizh/tahfizh-section'],
      ['tahfizh-tpl-tahfizh-content', 'tahfizh/tahfizh-content'],
      ['tahfizh-history-row-template', 'tahfizh/history-row'],
      ['tahfizh-rekap-content-template', 'tahfizh/rekap-content'],
      ['tahfizh-tpl-rekap-row', 'tahfizh/rekap-row'],
      ['tahfizh-tpl-juz-block', 'tahfizh/juz-block'],
      ['tahfizh-analisis-prompt-template', 'tahfizh/analisis-prompt'],
      ['tahfizh-analisis-dashboard-template', 'tahfizh/analisis-dashboard']
    ];

    await Promise.all(templates.map(([id, name]) => this.ensureTemplate(id, name)));
  },

  /**
   * Load a layout
   * @param {string} layoutName - Name of the layout
   */
  async loadLayout(layoutName) {
    return this.load(`${this.layoutsPath}/${layoutName}.html`);
  },

  /**
   * Ensure extracted layout markup exists only when the inline version has been removed.
   * @param {string} elementId - Existing layout element id
   * @param {string} layoutName - File name without .html
   * @param {string} mountSelector - Parent selector used for insertion
   * @param {InsertPosition} position - Where to insert the layout
   */
  async ensureLayout(elementId, layoutName, mountSelector, position = 'beforeend') {
    if (document.getElementById(elementId)) return document.getElementById(elementId);

    const mount = document.querySelector(mountSelector);
    if (!mount) {
      console.warn(`[ComponentLoader] Layout mount ${mountSelector} not found`);
      return null;
    }

    const html = await this.loadLayout(layoutName);
    if (!html) return null;

    mount.insertAdjacentHTML(position, html);
    if (window.lucide) lucide.createIcons();
    return document.getElementById(elementId);
  },

  /**
   * Prepare extracted layouts for the gradual migration.
   */
  async ensureCriticalLayouts() {
    await Promise.all([
      this.ensureLayout('desktop-sidebar', 'sidebar-desktop', '#view-main', 'afterbegin'),
      this.ensureLayout('bottom-nav', 'bottom-nav', '#view-main', 'beforeend')
    ]);
  },

  /**
   * Ensure an auth page exists in the DOM, loading it from src/pages/auth when missing.
   * @param {string} viewId - DOM view id
   * @param {string} pageName - File name without .html
   */
  async ensureAuthPage(viewId, pageName) {
    if (document.getElementById(viewId)) return document.getElementById(viewId);

    const html = await this.loadPage(pageName, 'auth');
    if (!html) return null;

    document.body.insertAdjacentHTML('beforeend', html);
    if (window.lucide) lucide.createIcons();
    return document.getElementById(viewId);
  },

  /**
   * Prepare extracted auth pages for the gradual migration.
   */
  async ensureAuthPages() {
    await Promise.all([
      this.ensureAuthPage('view-onboarding', 'onboarding'),
      this.ensureAuthPage('view-login', 'login')
    ]);
  },

  /**
   * Ensure a standalone view page exists in the DOM.
   * @param {string} viewId - DOM view id
   * @param {string} pageName - File name without .html
   * @param {string} section - Folder under src/pages
   */
  async ensureStandalonePage(viewId, pageName, section) {
    if (document.getElementById(viewId)) return document.getElementById(viewId);

    const html = await this.loadPage(pageName, section);
    if (!html) return null;

    document.body.insertAdjacentHTML('beforeend', html);
    if (window.lucide) lucide.createIcons();
    return document.getElementById(viewId);
  },

  /**
   * Prepare standalone pages for the gradual migration.
   */
  async ensureStandalonePages() {
    await Promise.all([
      this.ensureStandalonePage('view-attendance', 'attendance', 'attendance'),
      this.ensureStandalonePage('view-qibla', 'qibla', 'qibla')
    ]);
  },

  /**
   * Ensure a main app tab/page exists inside #view-main.
   * @param {string} pageId - DOM page id
   * @param {string} pageName - File name without .html
   * @param {string} section - Folder under src/pages
   */
  async ensureAppPage(pageId, pageName, section) {
    if (document.getElementById(pageId)) return document.getElementById(pageId);

    const viewMain = document.getElementById('view-main');
    if (!viewMain) {
      console.warn('[ComponentLoader] #view-main not found');
      return null;
    }

    const html = await this.loadPage(pageName, section);
    if (!html) return null;

    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav?.parentElement === viewMain) {
      bottomNav.insertAdjacentHTML('beforebegin', html);
    } else {
      viewMain.insertAdjacentHTML('beforeend', html);
    }

    if (window.lucide) lucide.createIcons();
    return document.getElementById(pageId);
  },

  /**
   * Prepare extracted main app pages for the gradual migration.
   */
  async ensureAppPages() {
    const pages = [
      ['main-content', 'dashboard', 'dashboard'],
      ['tab-notifications', 'notifications', 'notifications'],
      ['tab-report', 'report', 'report'],
      ['tab-profile', 'profile', 'profile'],
      ['tab-tahfizh', 'tahfizh', 'tahfizh'],
      ['tab-admin', 'admin', 'admin']
    ];

    await Promise.all(pages.map(([id, name, section]) => this.ensureAppPage(id, name, section)));
  },

  /**
   * Ensure a modal component exists in the DOM, loading it from src/components/modals when missing.
   * @param {string} modalId - DOM modal id
   * @param {string} modalName - File name without .html
   */
  async ensureModal(modalId, modalName) {
    if (document.getElementById(modalId)) return document.getElementById(modalId);

    const html = await this.loadComponent(modalName, 'modals');
    if (!html) return null;

    document.body.insertAdjacentHTML('beforeend', html);
    if (window.lucide) lucide.createIcons();
    return document.getElementById(modalId);
  },

  /**
   * Prepare simple extracted modals for the gradual migration.
   */
  async ensureCriticalModals() {
    const modals = [
      ['modal-rekap', 'modal-rekap'],
      ['modal-activity', 'modal-activity'],
      ['modal-confirm', 'modal-confirm'],
      ['modal-bulk-actions', 'modal-bulk-actions'],
      ['modal-stat-detail', 'modal-stat-detail'],
      ['modal-edit-permit', 'modal-edit-permit'],
      ['modal-input-pembinaan', 'modal-pembinaan'],
      ['modal-gps-guide', 'modal-gps-guide'],
      ['bento-detail-modal', 'modal-bento-detail'],
      ['modal-wali-permit', 'modal-wali-permit'],
      ['modal-musyrif-approval', 'modal-musyrif-approval'],
      ['modal-exit-ticket', 'modal-exit-ticket'],
      ['modal-edit-wali-permit', 'modal-edit-wali-permit'],
      ['modal-delete-wali-permit', 'modal-delete-wali-permit'],
      ['modal-permit', 'modal-permit'],
      ['modal-notification-settings', 'modal-notification-settings']
    ];

    await Promise.all(modals.map(([id, name]) => this.ensureModal(id, name)));
  },

  /**
   * Preload critical components
   */
  async preloadCritical() {
    if (this.isFileProtocol) {
      return;
    }

    const critical = [
      `${this.layoutsPath}/header.html`,
      `${this.layoutsPath}/bottom-nav.html`,
      `${this.layoutsPath}/sidebar-desktop.html`,
      `${this.pagesPath}/auth/onboarding.html`,
      `${this.pagesPath}/auth/login.html`,
      `${this.pagesPath}/attendance/attendance.html`,
      `${this.pagesPath}/qibla/qibla.html`,
      `${this.pagesPath}/dashboard/dashboard.html`,
      `${this.pagesPath}/dashboard/widgets/greeting.html`,
      `${this.pagesPath}/dashboard/widgets/countdown-widget.html`,
      `${this.pagesPath}/dashboard/widgets/location-card.html`,
      `${this.pagesPath}/dashboard/widgets/main-card.html`,
      `${this.pagesPath}/dashboard/widgets/prayer-widget.html`,
      `${this.pagesPath}/dashboard/widgets/pembinaan-widget.html`,
      `${this.pagesPath}/dashboard/widgets/weekly-calendar.html`,
      `${this.pagesPath}/dashboard/widgets/other-slots.html`,
      `${this.pagesPath}/notifications/notifications.html`,
      `${this.pagesPath}/report/report.html`,
      `${this.pagesPath}/report/report-section.html`,
      `${this.pagesPath}/report/analysis.html`,
      `${this.pagesPath}/profile/profile.html`,
      `${this.pagesPath}/profile/widgets/profile-hero.html`,
      `${this.pagesPath}/profile/widgets/timesheet.html`,
      `${this.pagesPath}/profile/widgets/pembinaan.html`,
      `${this.pagesPath}/profile/widgets/permit-archive.html`,
      `${this.pagesPath}/tahfizh/tahfizh.html`,
      `${this.pagesPath}/tahfizh/pages/beranda.html`,
      `${this.pagesPath}/tahfizh/pages/form.html`,
      `${this.pagesPath}/tahfizh/pages/analisis.html`,
      `${this.pagesPath}/tahfizh/pages/riwayat.html`,
      `${this.pagesPath}/tahfizh/pages/rekap.html`,
      `${this.templatesPath}/tahfizh/jadwal-perpulangan.html`,
      `${this.templatesPath}/tahfizh/accordion-item.html`,
      `${this.templatesPath}/tahfizh/peringkat-section.html`,
      `${this.templatesPath}/tahfizh/peringkat-item.html`,
      `${this.templatesPath}/tahfizh/tahfizh-section.html`,
      `${this.templatesPath}/tahfizh/tahfizh-content.html`,
      `${this.templatesPath}/tahfizh/history-row.html`,
      `${this.templatesPath}/tahfizh/rekap-content.html`,
      `${this.templatesPath}/tahfizh/rekap-row.html`,
      `${this.templatesPath}/tahfizh/juz-block.html`,
      `${this.templatesPath}/tahfizh/analisis-prompt.html`,
      `${this.templatesPath}/tahfizh/analisis-dashboard.html`,
      `${this.basePath}/modals/modal-rekap.html`,
      `${this.basePath}/modals/modal-activity.html`,
      `${this.basePath}/modals/modal-confirm.html`,
      `${this.basePath}/modals/modal-bulk-actions.html`,
      `${this.basePath}/modals/modal-stat-detail.html`,
      `${this.basePath}/modals/modal-edit-permit.html`,
      `${this.basePath}/modals/modal-pembinaan.html`,
      `${this.basePath}/modals/modal-gps-guide.html`,
      `${this.basePath}/modals/modal-bento-detail.html`,
      `${this.basePath}/modals/modal-wali-permit.html`,
      `${this.basePath}/modals/modal-musyrif-approval.html`,
      `${this.basePath}/modals/modal-exit-ticket.html`,
      `${this.basePath}/modals/modal-edit-wali-permit.html`,
      `${this.basePath}/modals/modal-delete-wali-permit.html`,
      `${this.basePath}/modals/modal-permit.html`,
      `${this.basePath}/modals/modal-notification-settings.html`
    ];

    await Promise.all(critical.map(path => this.load(path).catch(() => '')));
  },

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  },

  /**
   * Get component from cache
   * @param {string} path - Component path
   */
  getCached(path) {
    return this.cache.get(path) || null;
  }
};

// Export for global use
window.ComponentLoader = ComponentLoader;
