const storages = {};

function getStorage(name) {
  if (!Object.prototype.hasOwnProperty.call(storages, name)) {
    try {
      const storage = window[name];
      if (storage) {
        const key = '__test__' + Date.now();
        storage.setItem(key, '');
        storage.removeItem(key);
      }
      storages[name] = storage || null;
    } catch (error) {
      storages[name] = null;
    }
  }

  return storages[name];
}

/**
 * The local and session storage, or null when the browser does not allow them, e.g. in a private
 * window or with storage disabled, and reads and writes that do not throw.
 */
const WebStorage = {
  getLocalStorage() {
    return getStorage('localStorage');
  },

  getSessionStorage() {
    return getStorage('sessionStorage');
  },

  getItemGuarded(storage, key) {
    if (!storage) {
      return null;
    }

    try {
      return storage.getItem(key);
    } catch (error) {
      return null;
    }
  },

  /**
   * Writes the item and returns null, or the error, e.g. when the storage is full.
   */
  setItemGuarded(storage, key, value) {
    if (!storage) {
      return new Error('WebStorage: the storage is not available.');
    }

    try {
      storage.setItem(key, value);
      return null;
    } catch (error) {
      return error;
    }
  },

  removeItemGuarded(storage, key) {
    if (!storage) {
      return;
    }

    try {
      storage.removeItem(key);
    } catch (error) {
      // The storage can deny access, e.g. when it is disabled.
    }
  }
};

export default WebStorage;
