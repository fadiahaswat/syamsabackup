(function () {
  const parseJson = function (value, fallback = null) {
    if (window.SharedUtils?.safeJsonParse) {
      return window.SharedUtils.safeJsonParse(value, fallback);
    }
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn("[AppStorage] Invalid JSON, using fallback:", error.message);
      return fallback;
    }
  };

  const getItem = function (key, fallback = null, storage = localStorage) {
    try {
      const value = storage.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      console.warn("[AppStorage] Failed to read item:", key, error.message);
      return fallback;
    }
  };

  const setItem = function (key, value, storage = localStorage) {
    try {
      storage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn("[AppStorage] Failed to write item:", key, error.message);
      return false;
    }
  };

  const removeItem = function (key, storage = localStorage) {
    try {
      storage.removeItem(key);
      return true;
    } catch (error) {
      console.warn("[AppStorage] Failed to remove item:", key, error.message);
      return false;
    }
  };

  const getJson = function (key, fallback = null, storage = localStorage) {
    return parseJson(getItem(key, null, storage), fallback);
  };

  const setJson = function (key, value, storage = localStorage) {
    return setItem(key, JSON.stringify(value), storage);
  };

  window.AppStorage = {
    getItem,
    setItem,
    removeItem,
    getJson,
    setJson,
    session: {
      getItem: (key, fallback = null) => getItem(key, fallback, sessionStorage),
      setItem: (key, value) => setItem(key, value, sessionStorage),
      removeItem: (key) => removeItem(key, sessionStorage),
      getJson: (key, fallback = null) => getJson(key, fallback, sessionStorage),
      setJson: (key, value) => setJson(key, value, sessionStorage),
    },
  };
})();
