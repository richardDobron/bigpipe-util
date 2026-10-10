import Arbiter from './core/Arbiter';
import goOrReplace from './core/goOrReplace';
import { byTag } from './core/Parent';
import reportError from './core/reportError';

export const DELAY_HISTORY = 'delay_history';

const SKIPPED_REL = /(?:^|\s)(?:async(?:-post)?|dialog|external)(?:\s|$)/;

let initialized = false;
let currentURI = null;
let transitioning = false;
let handlers = [];
let beforeLeaveHooks = [];
let leaveHooks = [];
let completionCallbacks = [];
const scrollPositions = new Map();

function toURI(uri) {
  return new URL(uri, window.location.href);
}

function key(uri) {
  return uri.pathname + uri.search + uri.hash;
}

function withoutHash(uri) {
  return uri.origin + uri.pathname + uri.search;
}

function isHttp(uri) {
  return uri.protocol === 'http:' || uri.protocol === 'https:';
}

function scrollTo(position) {
  window.scrollTo(position.x, position.y);
}

function updateHistory(uri, replace) {
  const state = { uri: key(uri) };
  if (replace) {
    window.history.replaceState(state, '', uri.href);
  } else {
    window.history.pushState(state, '', uri.href);
  }
}

function handleTransition(uri) {
  for (let priority = handlers.length - 1; priority >= 0; priority -= 1) {
    const list = handlers[priority];
    for (let i = list ? list.length - 1 : -1; i >= 0; i -= 1) {
      const result = list[i](uri);
      if (result === true || result === DELAY_HISTORY) {
        new Arbiter().inform('page_transition', { uri });
        return result;
      }
      list.splice(i, 1);
    }
  }

  return false;
}

function onClick(event) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  ) {
    return;
  }

  const link = byTag(event.target, 'A');
  if (
    !link ||
    !link.hasAttribute('href') ||
    link.hasAttribute('download') ||
    link.hasAttribute('ajaxify') ||
    (link.target && link.target !== '_self') ||
    SKIPPED_REL.test(link.getAttribute('rel') || '')
  ) {
    return;
  }

  const uri = toURI(link.href);
  if (!isHttp(uri) || uri.origin !== window.location.origin) {
    return;
  }

  event.preventDefault();
  PageTransitions.go(uri.href);
}

function onSubmit(event) {
  const form = event.target;
  if (
    event.defaultPrevented ||
    !form ||
    form.nodeName !== 'FORM' ||
    form.getAttribute('rel') ||
    (form.target && form.target !== '_self') ||
    (form.getAttribute('method') || 'GET').toUpperCase() !== 'GET'
  ) {
    return;
  }

  const uri = toURI(form.getAttribute('action') || window.location.href);
  if (!isHttp(uri) || uri.origin !== window.location.origin) {
    return;
  }

  const data = new FormData(form);
  if (event.submitter && event.submitter.name) {
    data.append(event.submitter.name, event.submitter.value);
  }

  uri.search = new URLSearchParams(data).toString();
  uri.hash = '';

  event.preventDefault();
  PageTransitions.go(uri.href);
}

function onPopState(event) {
  const state = event.state;
  if (!state || typeof state.uri !== 'string') {
    return;
  }

  load(toURI(state.uri), true, () => goOrReplace(window.location, toURI(state.uri).href, true));
}

function onScroll() {
  if (!transitioning && currentURI) {
    scrollPositions.set(key(currentURI), { x: window.scrollX, y: window.scrollY });
  }
}

function load(uri, fromHistory, fallback) {
  if (uri.hash && withoutHash(uri) === withoutHash(currentURI)) {
    new Arbiter().inform('pre_page_fragment_transition', { from: currentURI.hash, to: uri.hash });
    if (!fromHistory) {
      updateHistory(uri, false);
    }
    currentURI = uri;
    if (!PageTransitions.restoreScrollPosition(uri)) {
      const target = document.getElementById(decodeURIComponent(uri.hash.slice(1)));
      if (target) {
        target.scrollIntoView();
      }
    }
    new Arbiter().inform('page_fragment_transition', { fragment: uri.hash });
    return;
  }

  const message = runHooks(beforeLeaveHooks).find(Boolean);
  if (message && !window.confirm(message)) {
    if (fromHistory) {
      updateHistory(currentURI, false);
    }
    return;
  }

  new Arbiter().inform('pre_page_transition', { from: currentURI, to: uri });

  transitioning = true;
  const result = handleTransition(uri);

  if (!result) {
    transitioning = false;
    fallback();
    return;
  }

  currentURI = uri;
  if (!fromHistory) {
    if (result === DELAY_HISTORY) {
      window.setTimeout(() => updateHistory(uri, false), 0);
    } else {
      updateHistory(uri, false);
    }
  }
}

function runHooks(hooks) {
  return hooks.map(hook => {
    try {
      return hook();
    } catch (error) {
      reportError(error);
      return null;
    }
  });
}

function addHook(hooks, hook) {
  hooks.push(hook);
  return {
    remove() {
      const index = hooks.indexOf(hook);
      if (index !== -1) {
        hooks.splice(index, 1);
      }
    }
  };
}

const PageTransitions = {
  /**
   * Takes over the same-origin links and GET forms of the page and the back and forward buttons,
   * and lets the registered handlers load the next page, see Quickling.
   */
  init() {
    if (initialized || window.top !== window.self) {
      return initialized;
    }
    initialized = true;

    currentURI = toURI(window.location.href);
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    updateHistory(currentURI, true);

    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    window.addEventListener('popstate', onPopState);
    window.addEventListener('scroll', onScroll, { passive: true });

    return true;
  },

  isInitialized() {
    return initialized;
  },

  isTransitioning() {
    return transitioning;
  },

  getCurrentURI() {
    return currentURI ? new URL(currentURI.href) : toURI(window.location.href);
  },

  /**
   * A handler gets the URL and returns true (or DELAY_HISTORY) when it loads the page. A handler
   * that returns false is removed. Handlers of a higher priority are asked first.
   */
  registerHandler(handler, priority = 0) {
    if (!handlers[priority]) {
      handlers[priority] = [];
    }
    handlers[priority].push(handler);
  },

  removeHandler(handler, priority = 0) {
    const list = handlers[priority] || [];
    const index = list.indexOf(handler);
    if (index !== -1) {
      list.splice(index, 1);
    }
  },

  /**
   * The hook returns a message to confirm before the page is left, e.g. about unsaved changes,
   * or nothing.
   */
  addBeforeLeaveHook(hook) {
    return addHook(beforeLeaveHooks, hook);
  },

  /**
   * The hook runs when the page is left for the next one.
   */
  addLeaveHook(hook) {
    return addHook(leaveHooks, hook);
  },

  runLeaveHooks() {
    const hooks = leaveHooks;
    leaveHooks = [];
    beforeLeaveHooks = [];
    runHooks(hooks);
  },

  registerCompletionCallback(callback) {
    completionCallbacks.push(callback);
  },

  /**
   * Loads the page at the URL with a page transition, or else with a full page load.
   */
  go(uri, replace = false) {
    const next = toURI(uri);

    if (!initialized) {
      goOrReplace(window.location, next.href, replace);
      return;
    }

    scrollPositions.delete(key(next));
    load(next, false, () => goOrReplace(window.location, next.href, replace));
  },

  /**
   * Called once the next page is displayed: restores the scroll position of a page visited with
   * the back or forward button, and runs the completion callbacks.
   */
  transitionComplete(keepScroll = false) {
    transitioning = false;

    const callbacks = completionCallbacks;
    completionCallbacks = [];
    runHooks(callbacks);

    if (!keepScroll && currentURI) {
      PageTransitions.restoreScrollPosition(currentURI);
    }

    try {
      if (document.activeElement && document.activeElement.nodeName === 'A') {
        document.activeElement.blur();
      }
    } catch (e) {
      // The active element can be inaccessible.
    }
  },

  restoreScrollPosition(uri) {
    const position = scrollPositions.get(key(toURI(uri)));
    if (!position) {
      return false;
    }
    scrollTo(position);
    return true;
  }
};

export default PageTransitions;
