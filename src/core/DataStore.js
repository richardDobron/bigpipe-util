const objects = new WeakMap();
const names = new Map();

function storage(namespace, create) {
  if (!namespace) {
    throw new TypeError('DataStore: a namespace is required, got ' + typeof namespace);
  }

  const store = typeof namespace === 'string' ? names : objects;
  let data = store.get(namespace);

  if (!data && create) {
    data = new Map();
    store.set(namespace, data);
  }

  return data;
}

/**
 * Keeps data for an element (or any object, or a string namespace) without putting it on the
 * element itself. The data of an element goes away with the element.
 */
const DataStore = {
  set(namespace, key, value) {
    storage(namespace, true).set(key, value);
    return namespace;
  },

  /**
   * Returns the value, or else the `data-<key>` attribute of an element, or else `defaultValue`,
   * which is then stored.
   */
  get(namespace, key, defaultValue) {
    const data = storage(namespace, false);
    let value = data ? data.get(key) : undefined;

    if (value === undefined && typeof namespace.getAttribute === 'function') {
      const attribute = namespace.getAttribute('data-' + key);
      value = attribute === null ? undefined : attribute;
    }

    if (value === undefined && defaultValue !== undefined) {
      DataStore.set(namespace, key, defaultValue);
      value = defaultValue;
    }

    return value;
  },

  remove(namespace, key) {
    const data = storage(namespace, false);
    if (!data) {
      return undefined;
    }

    const value = data.get(key);
    data.delete(key);
    if (data.size === 0) {
      DataStore.purge(namespace);
    }
    return value;
  },

  purge(namespace) {
    (typeof namespace === 'string' ? names : objects).delete(namespace);
  }
};

export default DataStore;
