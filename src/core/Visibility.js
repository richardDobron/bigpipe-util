import Arbiter from './Arbiter';

const HIDDEN = 'hidden';
const VISIBLE = 'visible';

function isSupported() {
  return typeof document !== 'undefined' && typeof document.hidden !== 'undefined';
}

function isHidden() {
  return isSupported() ? document.hidden : false;
}

if (isSupported()) {
  document.addEventListener('visibilitychange', event => {
    new Arbiter().inform('Visibility/' + (isHidden() ? HIDDEN : VISIBLE), {
      changeTime: event.timeStamp
    });
  });
}

/**
 * Whether the page is hidden, e.g. in a background tab, and the events when it is hidden or
 * shown again.
 */
export default {
  HIDDEN,
  VISIBLE,
  isHidden,
  isSupported,

  /**
   * Calls `callback` when the page is hidden (`Visibility.HIDDEN`) or shown (`Visibility.VISIBLE`).
   * Returns a subscription whose `remove()` stops it.
   */
  subscribe(event, callback) {
    return new Arbiter().subscribe('Visibility/' + event, callback);
  }
};
