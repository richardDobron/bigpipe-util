import getCSPNonce from './core/getCSPNonce';
import reportError from './core/reportError';
import requireModule from './core/requireModule';
import { requestIdleCallbackAcrossTransitions } from './core/TimerStorage';
import warning from './core/warning';

const MAX_PRELOADS = 2;

// The delays before a script that failed to load is requested again, e.g. after a network hiccup.
const JS_RETRY_DELAYS = [500, 2000];

// A stylesheet that neither loads nor fails in time stops holding up its pagelet and the JS of the page.
const CSS_TIMEOUT = 5000;

const resourceMap = new Map();
const requests = new Map();
const bootloadable = new Map();
const preloadQueue = [];
const preloading = new Set();
const preloaded = new Set();
const failed = new Set();

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

function findOnPage(url, type) {
  if (type === 'css') {
    return Array.from(document.querySelectorAll('link[rel~="stylesheet"]')).find(
      link => link.href === url
    );
  }

  return Array.from(document.querySelectorAll('script[src]')).find(script => script.src === url);
}

// A blocking script and a stylesheet in the head have loaded before the code that asks. An async,
// deferred or module script, or a stylesheet in the body, has loaded once the page has.
function hasLoaded(element, type) {
  if (document.readyState === 'complete') {
    return true;
  }

  if (type === 'css') {
    return element.parentNode === document.head;
  }

  return (
    !element.hasAttribute('async') && !element.hasAttribute('defer') && element.type !== 'module'
  );
}

function isOnPage(url, type) {
  const element = findOnPage(url, type);

  return Boolean(element) && hasLoaded(element, type);
}

function isNetworkIdle() {
  return Array.from(requests.values()).every(entry => entry.loaded);
}

function preload(name, onLoad, execute = true) {
  const { type, src } = getResource(name);
  const url = resolveURL(src);

  if (requests.has(url) || preloading.has(url) || preloaded.has(url)) {
    return false;
  }

  preloading.add(url);

  const link = document.createElement('link');
  link.rel = 'preload';
  link.setAttribute('as', type === 'css' ? 'style' : 'script');
  link.href = src;

  const nonce = getCSPNonce();
  if (nonce) {
    link.setAttribute('nonce', nonce);
  }

  link.onload = link.onerror = () => {
    preloading.delete(url);
    preloaded.add(url);
    if (type === 'js' && execute) {
      requestIdleCallbackAcrossTransitions(() => Bootloader.loadResources([name]));
    }
    if (onLoad) {
      onLoad();
    }
  };
  document.head.appendChild(link);

  return true;
}

function runPreloadQueue() {
  while (preloadQueue.length > 0 && preloading.size < MAX_PRELOADS && isNetworkIdle()) {
    preload(preloadQueue.pop().name, runPreloadQueue);
  }
}

function enqueuePreload(name, priority) {
  if (preloadQueue.some(job => job.name === name)) {
    return;
  }

  const index = preloadQueue.findIndex(job => job.priority >= priority);
  preloadQueue.splice(index === -1 ? preloadQueue.length : index, 0, { name, priority });
  runPreloadQueue();
}

function request({ type, src }) {
  const url = resolveURL(src);
  let entry = requests.get(url);

  if (entry) {
    return entry;
  }

  entry = { loaded: false, callbacks: [] };
  requests.set(url, entry);

  const onPage = findOnPage(url, type);
  if (onPage) {
    if (hasLoaded(onPage, type)) {
      entry.loaded = true;
    } else {
      const done = () => Bootloader.done(url);
      onPage.addEventListener('load', done);
      onPage.addEventListener('error', done);
      window.addEventListener('load', done, { once: true });
    }
    return entry;
  }

  let retries = 0;

  const insert = () => {
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

    const timer =
      type === 'css'
        ? setTimeout(() => {
            warning(false, 'Bootloader: the stylesheet %s did not load in %sms.', url, CSS_TIMEOUT);
            Bootloader.done(url);
          }, CSS_TIMEOUT)
        : null;

    element.onload = () => {
      clearTimeout(timer);
      Bootloader.done(url);
    };
    element.onerror = () => {
      clearTimeout(timer);
      if (type === 'js' && retries < JS_RETRY_DELAYS.length) {
        setTimeout(() => {
          element.remove();
          insert();
        }, JS_RETRY_DELAYS[retries]);
        retries += 1;
        return;
      }

      // A file that fails to load does not stop the page: it counts as loaded, and is reported.
      failed.add(url);
      Bootloader.done(url);
      reportError(new Error('Bootloader: failed to load ' + url));
    };
    (type === 'css' ? document.head : document.body).appendChild(element);
  };

  insert();

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
   * Adds the modules that can be loaded later, with the resources each of them needs:
   * `{Module: [names or URLs]}`, or `{Module: {resources, priority}}` to preload the resources of
   * a module with a priority above 0 while the network is idle, higher priorities first.
   */
  enableBootload(map) {
    Object.keys(map || {}).forEach(module => {
      if (bootloadable.has(module)) {
        return;
      }

      const entry = Array.isArray(map[module]) ? { resources: map[module] } : map[module];
      const resources = entry.resources || [];
      bootloadable.set(module, resources);

      if (entry.priority > 0) {
        resources.forEach(name => enqueuePreload(name, entry.priority));
      }
    });
  },

  /**
   * Preloads the resources of the modules right away, e.g. of a dialog the user is likely to
   * open, so that loading the modules later is fast. Their scripts run once the browser is idle.
   */
  preloadModules(modules) {
    modules.forEach(module => {
      (bootloadable.get(module) || []).forEach(name => preload(name));
    });
  },

  prefetch(names) {
    names.forEach(name => preload(name, null, false));
  },

  isBootloadable(module) {
    return bootloadable.has(module);
  },

  /**
   * Loads the resources of the modules, then calls `callback` with the modules. Modules that are
   * not bootloadable are required right away.
   */
  loadModules(modules, callback, onError) {
    const names = modules.reduce((all, module) => all.concat(bootloadable.get(module) || []), []);

    Bootloader.loadResources(names, () => {
      let exports;
      try {
        exports = modules.map(module => requireModule(module));
      } catch (error) {
        if (!onError) {
          throw error;
        }
        onError(error);
        return;
      }
      if (callback) {
        callback(...exports);
      }
    });
  },

  isLoaded(module) {
    return (bootloadable.get(module) || []).every(name => {
      const { type, src } = getResource(name);
      const url = resolveURL(src);
      const entry = requests.get(url);
      return entry ? entry.loaded : isOnPage(url, type);
    });
  },

  /**
   * The URLs of the stylesheets and scripts that failed to load, scripts after their retries.
   */
  getErrorURLs() {
    return Array.from(failed);
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

    runPreloadQueue();
  },

  resolveURL
};

export function requireLazy(modules, callback) {
  Bootloader.loadModules(modules, callback);
}

export default Bootloader;
