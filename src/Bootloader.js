import getCSPNonce from './core/getCSPNonce';
import reportError from './core/reportError';

const resourceMap = new Map();
const requests = new Map();

function resolveURL(src) {
  try {
    return new URL(src, document.baseURI).href;
  } catch (e) {
    return src;
  }
}

function getResource(name, type) {
  return (
    resourceMap.get(name) || {
      type: type || (/\.css(?:[?#]|$)/.test(name) ? 'css' : 'js'),
      src: name
    }
  );
}

function isOnPage(url, type) {
  if (type === 'css') {
    return Array.from(document.querySelectorAll('link[rel~="stylesheet"]')).some(
      link => link.href === url
    );
  }

  return Array.from(document.querySelectorAll('script[src]')).some(script => script.src === url);
}

function request({ type, src }) {
  const url = resolveURL(src);
  let entry = requests.get(url);

  if (entry) {
    return entry;
  }

  entry = { loaded: false, callbacks: [] };
  requests.set(url, entry);

  if (isOnPage(url, type)) {
    entry.loaded = true;
    return entry;
  }

  let element;
  if (type === 'css') {
    element = document.createElement('link');
    element.rel = 'stylesheet';
    element.href = src;
  } else {
    element = document.createElement('script');
    element.src = src;
    element.async = false;
  }

  const nonce = getCSPNonce();
  if (nonce) {
    element.setAttribute('nonce', nonce);
  }

  element.onload = () => Bootloader.done(url);
  element.onerror = () => Bootloader.done(url);
  (type === 'css' ? document.head : document.body).appendChild(element);

  return entry;
}

const Bootloader = {
  /**
   * Adds resources by name: `{name: {type: 'css' | 'js', src}}`. A name keeps its first resource.
   */
  setResourceMap(map) {
    Object.keys(map || {}).forEach(name => {
      if (!resourceMap.has(name)) {
        resourceMap.set(name, map[name]);
      }
    });
  },

  /**
   * Loads the resources, names from the resource map or URLs of the given type, and calls
   * `callback` once all of them are loaded. Every URL is loaded once, and a stylesheet or script
   * that is already on the page is not loaded again.
   */
  loadResources(names, callback, type) {
    const pending = names.map(name => request(getResource(name, type))).filter(e => !e.loaded);
    let count = pending.length;

    if (count === 0) {
      if (callback) {
        callback();
      }
      return;
    }

    pending.forEach(entry => {
      entry.callbacks.push(() => {
        count -= 1;
        if (count === 0 && callback) {
          callback();
        }
      });
    });
  },

  /**
   * Marks the resource at the URL as loaded, also when it failed to load.
   */
  done(src) {
    const entry = requests.get(resolveURL(src));

    if (!entry || entry.loaded) {
      return;
    }

    entry.loaded = true;
    entry.callbacks.splice(0).forEach(callback => {
      try {
        callback();
      } catch (error) {
        reportError(error);
      }
    });
  },

  resolveURL
};

export default Bootloader;
