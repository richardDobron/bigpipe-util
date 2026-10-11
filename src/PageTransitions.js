import Arbiter from './core/Arbiter';
import goOrReplace from './core/goOrReplace';
import onAfterLoad from './core/onAfterLoad';
import { byTag } from './core/Parent';
import reportError from './core/reportError';

export const DELAY_HISTORY = 'delay_history';

const SKIPPED_REL = /(?:^|\s)(?:async(?:-post)?|dialog|external)(?:\s|$)/;

let initialized = false;
let currentURI = null;
let transitioning = false;
let leaveConfirmed = false;
let handlers = [];
let beforeLeaveHooks = [];
let leaveHooks = [];
let completionCallbacks = [];
let pendingHistory = null;
let currentIndex = 0;
let currentId = null;
// The scroll positions of the history entries by their id. They are also kept in the state of the
// entries, for a page loaded in full again, e.g. reloaded.
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

function indexOf(state) {
  return state && typeof state.index === 'number' ? state.index : null;
}

function idOf(state) {
  return state && typeof state.id === 'string' ? state.id : null;
}

function createId() {
  return Math.random().toString(36).slice(2);
}

function saveScrollPosition() {
  const position = scrollPositions.get(currentId);
  const state = window.history.state;
  if (position && currentId && idOf(state) === currentId) {
    window.history.replaceState({ ...state, scroll: position }, '', window.location.href);
  }
}

// Every entry has its index in the history, to go back to it when the user stays on the page
// after all, and an id for its scroll position. The index and the id of an entry another script
// added are not known.
function updateHistory(uri, replace, id = createId()) {
  if (!replace) {
    saveScrollPosition();
    currentIndex = currentIndex === null ? null : currentIndex + 1;
  }
  currentId = id;
  const state = { uri: key(uri), index: currentIndex, id };
  if (replace) {
    window.history.replaceState(state, '', uri.href);
  } else {
    window.history.pushState(state, '', uri.href);
  }
}

// The entry of a handler that delays it is added on the next tick, once the handler, e.g. Quickling,
// has left the page. A page that replaces it before then, e.g. a redirect, takes its place.
function addToHistory(uri, replace, delayed) {
  if (pendingHistory) {
    const pending = pendingHistory;
    window.clearTimeout(pending.timer);
    pendingHistory = null;
    if (replace) {
      replace = pending.replace;
    } else {
      updateHistory(pending.uri, pending.replace);
    }
  }

  if (!delayed) {
    updateHistory(uri, replace);
    return;
  }

  const timer = window.setTimeout(() => {
    pendingHistory = null;
    updateHistory(uri, replace);
  }, 0);
  pendingHistory = { uri, replace, timer };
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

// The entry can also be one without a state of ours, e.g. added by a script for a tab or by a
// change of the fragment: its URL is loaded all the same.
function onPopState(event) {
  // The entry of the page left with the back button is not added after all.
  if (pendingHistory) {
    window.clearTimeout(pendingHistory.timer);
    pendingHistory = null;
  }

  const { state } = event;
  const uri = toURI(window.location.href);
  const id = idOf(state);
  if (uri.href === currentURI.href && (!id || id === currentId)) {
    return;
  }

  const entry = { index: indexOf(state), id, scroll: state && state.scroll };
  load(uri, entry, false, () => goOrReplace(window.location, uri.href, true));
}

function onScroll() {
  if (!transitioning && currentId) {
    scrollPositions.set(currentId, { x: window.scrollX, y: window.scrollY });
  }
}

function enter(entry) {
  currentIndex = entry.index;
  currentId = entry.id;
  if (entry.id && entry.scroll && !scrollPositions.has(entry.id)) {
    scrollPositions.set(entry.id, entry.scroll);
  }
}

function onPageShow(event) {
  if (event.persisted) {
    leaveConfirmed = false;
    transitioning = false;
  }
}

// The page of the back or forward button comes with its history entry, the page of a link or of
// go() gets a new one.
function load(uri, entry, replace, fallback) {
  // The back button to an entry of the same page, e.g. without the fragment, only scrolls too.
  if ((uri.hash || entry) && withoutHash(uri) === withoutHash(currentURI)) {
    new Arbiter().inform('pre_page_fragment_transition', { from: currentURI.hash, to: uri.hash });
    if (entry) {
      enter(entry);
    } else {
      addToHistory(uri, replace, false);
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

  leaveConfirmed = false;
  const message = runHooks(beforeLeaveHooks).find(Boolean);
  if (message) {
    if (!window.confirm(message)) {
      if (entry) {
        stay(entry);
      }
      return;
    }
    leaveConfirmed = true;
  }

  if (entry) {
    enter(entry);
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
  if (!entry) {
    addToHistory(uri, replace, result === DELAY_HISTORY);
  }
}

// The user stays on the page after the back or forward button: the history goes back to its entry
// and keeps the entries after it. Without the indexes, the entry of the button becomes the page's.
function stay(entry) {
  if (entry.index !== null && currentIndex !== null) {
    if (currentIndex !== entry.index) {
      window.history.go(currentIndex - entry.index);
    }
    return;
  }

  currentIndex = entry.index;
  updateHistory(currentURI, true, currentId || undefined);
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
    // A page loaded in full again, e.g. reloaded, keeps the index and the id of its entry, and its
    // scroll position once it has loaded.
    const { state } = window.history;
    const entry =
      state && state.uri === key(currentURI)
        ? { index: indexOf(state), id: idOf(state), scroll: state.scroll }
        : { index: 0, id: null };
    enter({ ...entry, index: entry.index || 0 });
    updateHistory(currentURI, true, entry.id || undefined);
    if (entry.id && entry.scroll) {
      onAfterLoad(() => {
        if (currentId === entry.id && !transitioning) {
          PageTransitions.restoreScrollPosition(currentURI);
        }
      });
    }

    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    window.addEventListener('popstate', onPopState);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('pagehide', saveScrollPosition);

    return true;
  },

  isInitialized() {
    return initialized;
  },

  isTransitioning() {
    return transitioning;
  },

  isLeaveConfirmed() {
    return leaveConfirmed;
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
    leaveConfirmed = false;
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

    // A link to an empty fragment of the page, e.g. `href="#"`, goes nowhere: its click is
    // usually handled by a script.
    if (next.href.endsWith('#') && withoutHash(next) === withoutHash(currentURI)) {
      return;
    }

    load(next, null, replace, () => goOrReplace(window.location, next.href, replace));
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

  /**
   * Scrolls to the position the page had in its history entry, when the URL is of the current
   * page. A new entry, also one not added yet, has none.
   */
  restoreScrollPosition(uri) {
    const position =
      currentURI && key(toURI(uri)) === key(currentURI) && !pendingHistory
        ? scrollPositions.get(currentId)
        : null;
    if (!position) {
      return false;
    }
    scrollTo(position);
    return true;
  }
};

export default PageTransitions;
