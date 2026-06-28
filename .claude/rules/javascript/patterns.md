# JavaScript Patterns

## Manager Pattern

Use managers for business logic, isolated from UI:

```javascript
// src/managers/example-manager.js
class ExampleManager {
  #data = null;
  #listeners = [];

  init() {
    this.#data = this.loadFromStorage();
  }

  // Public API
  getAll() { return this.#data; }
  
  findById(id) {
    return this.#data?.find(item => item.id === id);
  }

  create(item) {
    const newItem = { ...item, id: this.generateId(), createdAt: Date.now() };
    this.#data = [...(this.#data || []), newItem];
    this.save();
    return newItem;
  }

  update(id, updates) {
    this.#data = this.#data.map(item => 
      item.id === id ? { ...item, ...updates, updatedAt: Date.now() } : item
    );
    this.save();
    return this.findById(id);
  }

  delete(id) {
    this.#data = this.#data.filter(item => item.id !== id);
    this.save();
  }

  // Event system
  subscribe(callback) {
    this.#listeners.push(callback);
    return () => {
      this.#listeners = this.#listeners.filter(cb => cb !== callback);
    };
  }

  #notify(event, data) {
    this.#listeners.forEach(cb => cb(event, data));
  }

  // Abstract methods for subclasses
  loadFromStorage() { return []; }
  save() {}
  generateId() { return Date.now().toString(36); }
}
```

## Storage Pattern

```javascript
class StorageManager {
  get(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
      console.error('Storage get error:', error);
      return defaultValue;
    }
  }

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  }

  remove(key) {
    localStorage.removeItem(key);
  }
}
```

## Event Bus Pattern

```javascript
const EventBus = {
  events: {},

  on(event, callback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
    return () => this.off(event, callback);
  },

  off(event, callback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  },

  emit(event, data) {
    if (!this.events[event]) return;
    this.events[event].forEach(cb => cb(data));
  }
};
```

## Template Pattern

```javascript
// Template literal with safe escaping
function renderSantriCard(santri) {
  const escape = (str) => String(str).replace(/[<>]/g, '');
  
  return `
    <div class="card" data-santri-id="${escape(santri.id)}">
      <div class="avatar" style="background-color: ${santri.color}">
        ${escape(santri.name.charAt(0))}
      </div>
      <div class="info">
        <h3>${escape(santri.name)}</h3>
        <p class="meta">${escape(santri.kelas)}</p>
      </div>
      <div class="status status-${escape(santri.status)}">
        ${escape(santri.statusLabel)}
      </div>
    </div>
  `;
}
```

## State Management Pattern

```javascript
const createStore = (initialState) => {
  let state = initialState;
  const listeners = new Set();

  return {
    getState: () => state,
    
    setState: (updates) => {
      const prev = state;
      state = { ...state, ...(typeof updates === 'function' ? updates(state) : updates) };
      listeners.forEach(listener => listener(state, prev));
    },
    
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
};
```

## Router Pattern (Hash-based)

```javascript
class Router {
  constructor() {
    this.routes = {};
    window.addEventListener('hashchange', () => this.handleRoute());
  }

  addRoute(path, handler) {
    this.routes[path] = handler;
  }

  navigate(path) {
    window.location.hash = path;
  }

  handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const [path, ...params] = hash.split('/');
    
    const handler = this.routes[path] || this.routes['/'];
    if (handler) handler(params);
  }
}
```