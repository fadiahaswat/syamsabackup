/**
 * Template Loader Module
 * Loads HTML templates dynamically into the document
 */

const Templates = {
  /**
   * Cache for loaded templates
   */
  cache: new Map(),

  /**
   * Load a template file and inject into document
   * @param {string} id - The ID to assign to the loaded template
   * @param {string} path - Path to the template HTML file
   * @returns {Promise<HTMLElement>} The template element
   */
  async load(id, path) {
    // Return cached if exists
    const existing = document.getElementById(id);
    if (existing) return existing;

    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Failed to load template: ${path}`);

      const html = await response.text();

      // Create template element
      const template = document.createElement('template');
      template.id = id;
      template.innerHTML = html;

      // Inject into body
      document.body.appendChild(template);

      // Cache it
      this.cache.set(id, template);

      return template;
    } catch (error) {
      console.error(`[Templates] Error loading ${id}:`, error);
      throw error;
    }
  },

  /**
   * Load multiple templates at once
   * @param {Array<{id: string, path: string}>} templates - Array of template definitions
   */
  async loadAll(templates) {
    await Promise.all(
      templates.map(t => this.load(t.id, t.path))
    );
  },

  /**
   * Get template content as HTML string
   * @param {string} id - Template ID
   * @returns {string|null} Template innerHTML or null
   */
  getContent(id) {
    const template = document.getElementById(id);
    return template ? template.innerHTML : null;
  },

  /**
   * Clone a template's content
   * @param {string} id - Template ID
   * @returns {Node|null} Cloned content or null
   */
  clone(id) {
    const template = document.getElementById(id);
    return template ? template.content.cloneNode(true) : null;
  }
};

// Auto-define window Templates for external access
window.Templates = Templates;
