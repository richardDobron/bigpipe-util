import BigPipe, { BIGPIPE_EVENT } from './BigPipe';
import PageTransitions, { DELAY_HISTORY } from './PageTransitions';
import AsyncRequest from './async/AsyncRequest';
import Arbiter from './core/Arbiter';
import DOM from './core/DOM';
import DocumentTitle from './core/DocumentTitle';
import goOrReplace from './core/goOrReplace';
import { clearAll as clearAllTimers } from './core/TimerStorage';

export const QUICKLING_EVENT = Object.freeze({
  SEND: 'ajaxpipe/send',
  FIRST_RESPONSE: 'ajaxpipe/first_response',
  BEFORE_CLEAR_CANVAS: 'ajaxpipe/onbeforeclearcanvas',
  UNLOAD: 'onload/exit',
  RESPONSE: 'quickling/response'
});

const REQUEST_PARAMS = /^(?:quickling|__req)(?:\[|$)/;

const config = {
  version: null,
  inactivePageRegex: null,
  badRequestKeys: [],
  sessionLength: 0
};

let canvas = null;
let initialized = false;
let loadCount = 0;
let currentRequest = null;

function withoutRequestParams(uri) {
  const url = new URL(uri, window.location.href);
  Array.from(url.searchParams.keys())
    .filter(name => REQUEST_PARAMS.test(name))
    .forEach(name => url.searchParams.delete(name));
  return url.href;
}

function normalizeVersion(version) {
  return version === undefined || version === null ? null : String(version);
}

function clearCanvas() {
  const bigPipe = new BigPipe();

  Array.from(bigPipe.pagelets.values()).forEach(pagelet => {
    const root = pagelet.getRoot();
    if (root && canvas.contains(root)) {
      bigPipe.removePagelet(pagelet);
    }
  });

  new Arbiter().inform(QUICKLING_EVENT.BEFORE_CLEAR_CANVAS, { canvas });
  new Arbiter().inform('pagelet/destroy', { id: null, root: canvas });
  DOM.empty(canvas);
}

function redirect(payload) {
  if (payload.force || !Quickling.isPageActive(payload.redirect)) {
    goOrReplace(window.location, withoutRequestParams(payload.redirect), true);
  } else {
    PageTransitions.go(payload.redirect, true);
  }
}

function onFirstResponse(request, uri, response) {
  if (request !== currentRequest) {
    return false;
  }

  const payload = response.payload || {};

  if (payload.redirect) {
    redirect(payload);
    return false;
  }

  if (normalizeVersion(payload.version) !== normalizeVersion(config.version)) {
    goOrReplace(window.location, withoutRequestParams(payload.uri || uri), true);
    return false;
  }

  new Arbiter().inform(QUICKLING_EVENT.FIRST_RESPONSE, { uri });

  if (typeof payload.title === 'string') {
    DocumentTitle.set(payload.title);
  }
  document.body.className = payload.body_class || '';
  window.scrollTo(0, 0);

  clearCanvas();
  new Arbiter().clearState(BIGPIPE_EVENT.DISPLAYED);

  return true;
}

function onResponse(response) {
  new Arbiter().inform(QUICKLING_EVENT.RESPONSE, { response });

  if (!response.pagelets || response.pagelets.length === 0) {
    PageTransitions.transitionComplete();
    return;
  }

  let completed = false;
  const subscription = new Arbiter().subscribe(BIGPIPE_EVENT.DISPLAYED, () => {
    if (!completed) {
      completed = true;
      PageTransitions.transitionComplete();
    }
  });

  if (completed) {
    subscription.remove();
  }
}

function transitionHandler(uri) {
  if (currentRequest) {
    const previous = currentRequest;
    currentRequest = null;
    previous.abort();
  }

  loadCount += 1;
  if (config.sessionLength > 0 && loadCount >= config.sessionLength) {
    return false;
  }

  if (!Quickling.isPageActive(uri.href) || !canvas || !canvas.isConnected) {
    return false;
  }

  clearAllTimers();
  new Arbiter().inform(QUICKLING_EVENT.UNLOAD, { transition_type: 'quickling' });
  PageTransitions.runLeaveHooks();

  const fullLoad = () => goOrReplace(window.location, withoutRequestParams(uri.href), true);
  const request = new AsyncRequest(uri.href)
    .setMethod('GET')
    .setData({ quickling: { version: config.version } })
    .setRelative(canvas)
    .setAllowCrossPageTransition(true)
    .setPreResponseHandler(response => onFirstResponse(request, uri.href, response))
    .setHandler(onResponse)
    .setErrorHandler(fullLoad)
    .setTransportErrorHandler(fullLoad)
    .setFinallyHandler(() => {
      if (currentRequest === request) {
        currentRequest = null;
      }
    });

  currentRequest = request;
  new Arbiter().inform(QUICKLING_EVENT.SEND, { uri: uri.href });
  request.send();

  return DELAY_HISTORY;
}

const Quickling = {
  /**
   * Loads the pages of the site into the canvas, the element with the content of the page,
   * instead of loading them in full. The server calls it with its configuration:
   * `version` of the page (a page of another version is loaded in full), `inactivePageRegex`
   * (paths always loaded in full), `badRequestKeys` (query parameters that need a full load) and
   * `sessionLength` (after this many page transitions the next page is loaded in full).
   */
  init(element, options = {}) {
    canvas = element;
    Object.assign(config, {
      ...options,
      inactivePageRegex: options.inactivePageRegex ? new RegExp(options.inactivePageRegex) : null,
      badRequestKeys: options.badRequestKeys || []
    });

    if (initialized) {
      return;
    }

    if (PageTransitions.init()) {
      initialized = true;
      PageTransitions.registerHandler(transitionHandler, 1);
    }
  },

  isActive() {
    return initialized;
  },

  getLoadCount() {
    return loadCount;
  },

  isPageActive(uri) {
    if (uri === '#') {
      return false;
    }

    const url = new URL(uri, window.location.href);
    if (url.origin !== window.location.origin) {
      return false;
    }

    const keys = Array.from(url.searchParams.keys()).map(name => name.replace(/\[.*$/, ''));
    if (keys.some(name => config.badRequestKeys.includes(name))) {
      return false;
    }

    return !(config.inactivePageRegex && config.inactivePageRegex.test(url.pathname + url.search));
  }
};

export default Quickling;
