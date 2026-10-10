import AsyncRequest from './async/AsyncRequest';
import onVisible from './core/onVisible';
import warning from './core/warning';

const VISIBLE_BUFFER = 300;

function whenIdle(callback) {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(callback);
  } else {
    setTimeout(callback, 1);
  }
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

    const request = () =>
      new AsyncRequest(uri)
        .setMethod('GET')
        .setData(data)
        .setRelative(root)
        .setStatusElement(root)
        .send();

    if (load === 'load') {
      request();
    } else if (load === 'idle') {
      whenIdle(request);
    } else {
      onVisible(root, request, { buffer: VISIBLE_BUFFER });
    }
  }
};
