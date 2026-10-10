import Arbiter from './Arbiter';

const EVENT = 'useractivity/activity';

let lastActivity = Date.now();
let lastInformTime = lastActivity;

function onActivity(event) {
  lastActivity = Date.now();
  const idleness = lastActivity - lastInformTime;

  if (idleness > 500) {
    lastInformTime = lastActivity;
    new Arbiter().inform(EVENT, { event, idleness, last_inform: lastInformTime });
  } else if (idleness < -5) {
    lastInformTime = lastActivity;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('scroll', onActivity, { passive: true });
  window.addEventListener('focus', onActivity);
  ['wheel', 'keydown', 'mouseover', 'mousemove', 'click', 'touchstart'].forEach(type =>
    document.documentElement.addEventListener(type, onActivity, { passive: true })
  );
}

/**
 * Whether the user is active on the page: scrolls, moves the mouse, clicks, types or focuses the
 * window.
 */
const UserActivity = {
  /**
   * Calls `callback` when the user is active again after more than half a second, with the
   * `idleness` in milliseconds. Returns a subscription whose `remove()` stops it.
   */
  subscribe(callback) {
    return new Arbiter().subscribe(EVENT, callback);
  },

  subscribeOnce(callback) {
    const subscription = UserActivity.subscribe(data => {
      subscription.remove();
      callback(data);
    });
    return subscription;
  },

  /**
   * Whether the user was active in the last `duration` milliseconds.
   */
  isActive(duration = 5000) {
    return Date.now() - lastActivity < duration;
  },

  getLastInformTime() {
    return lastInformTime;
  }
};

export default UserActivity;
