/**
 * Component Loader - Dynamic HTML/Template Loader
 * Loads HTML fragments asynchronously and injects into DOM
 */

const ComponentLoader = {
  // Cache for loaded components
  cache: new Map(),

  // Base path for components
  basePath: 'src/components',
  pagesPath: 'src/pages',
  templatesPath: 'src/templates',
  layoutsPath: 'src/layouts',

  /**
   * Load HTML content from a file
   * @param {string} path - Relative path to the HTML file
   * @returns {Promise<string>} HTML content
   */
  async load(path) {
    if (this.cache.has(path)) {
      return this.cache.get(path);
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
      ['tpl-activity-btn', 'activity-btn']
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
      ['modal-confirm', 'modal-confirm']
    ];

    await Promise.all(modals.map(([id, name]) => this.ensureModal(id, name)));
  },

  /**
   * Preload critical components
   */
  async preloadCritical() {
    const critical = [
      `${this.layoutsPath}/header.html`,
      `${this.layoutsPath}/bottom-nav.html`,
      `${this.layoutsPath}/sidebar-desktop.html`
    ];

    await Promise.all(critical.map(path => this.load(path)));
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
