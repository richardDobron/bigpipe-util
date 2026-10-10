import BigPipe from './BigPipe';
import AsyncRequest from './async/AsyncRequest';
import onVisible from './core/onVisible';
import warning from './core/warning';

const VISIBLE_BUFFER = 300;

function whenIdle(callback) {
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(callback);
    return { remove: () => cancelIdleCallback(handle) };
  }

  const timer = setTimeout(callback, 1);
  return { remove: () => clearTimeout(timer) };
}

export default {
  /**
   * Loads a pagelet into its placeholder, the element with the id `rootId`: when it becomes
   * visible (default), when the browser is idle (`load: 'idle'`) or right away (`load: 'load'`).
   * The server calls it for a `dobron\BigPipe\LazyPagelet` and responds with the pagelet.
   */
  loadFromEndpoint(uri, rootId, data = {}, { load = 'visible' } = {}) {
    const root = document.getElementById(rootId);

    warning(root, "UIPagelet: the placeholder '%s' is not on the page.", rootId);

    if (!root) {
      return;
    }

    let asyncRequest = null;
    const request = () => {
      asyncRequest = new AsyncRequest(uri)
        .setMethod('GET')
        .setData(data)
        .setRelative(root)
        .setStatusElement(root);
      asyncRequest.send();
    };

    let subscription = null;
    if (load === 'load') {
      request();
    } else if (load === 'idle') {
      subscription = whenIdle(request);
    } else {
      subscription = onVisible(root, request, { buffer: VISIBLE_BUFFER });
    }

    const pagelet = new BigPipe().getPageletForNode(root);
    if (pagelet) {
      pagelet.addDestructor(() => {
        if (subscription) {
          subscription.remove();
        }
        if (asyncRequest) {
          asyncRequest.abort();
        }
      });
    }
  }
};
