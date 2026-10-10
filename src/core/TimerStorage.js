const TIMEOUT = 'timeout';
const INTERVAL = 'interval';
const ANIMATION_FRAME = 'animationFrame';
const IDLE_CALLBACK = 'idleCallback';

const timers = {
  [TIMEOUT]: new Set(),
  [INTERVAL]: new Set(),
  [ANIMATION_FRAME]: new Set(),
  [IDLE_CALLBACK]: new Set()
};

function idle(callback) {
  if (typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(callback);
  }
  return window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 1);
}

function cancelIdle(id) {
  if (typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(id);
  } else {
    window.clearTimeout(id);
  }
}

const cancel = {
  [TIMEOUT]: id => window.clearTimeout(id),
  [INTERVAL]: id => window.clearInterval(id),
  [ANIMATION_FRAME]: id => window.cancelAnimationFrame(id),
  [IDLE_CALLBACK]: cancelIdle
};

function once(type, schedule, callback, ...args) {
  const id = schedule(
    (...callbackArgs) => {
      timers[type].delete(id);
      callback(...callbackArgs);
    },
    ...args
  );
  timers[type].add(id);
  return id;
}

function clear(type, id) {
  timers[type].delete(id);
  cancel[type](id);
}

/**
 * Timers that end with the page: a page transition clears them. Use the AcrossTransitions
 * variants, the plain browser functions, for timers that outlive the page.
 */
export function setTimeout(callback, delay, ...args) {
  return once(TIMEOUT, (fn, ...rest) => window.setTimeout(fn, ...rest), callback, delay, ...args);
}

export function clearTimeout(id) {
  clear(TIMEOUT, id);
}

export function setInterval(callback, delay, ...args) {
  const id = window.setInterval(callback, delay, ...args);
  timers[INTERVAL].add(id);
  return id;
}

export function clearInterval(id) {
  clear(INTERVAL, id);
}

export function requestAnimationFrame(callback) {
  return once(ANIMATION_FRAME, fn => window.requestAnimationFrame(fn), callback);
}

export function cancelAnimationFrame(id) {
  clear(ANIMATION_FRAME, id);
}

export function requestIdleCallback(callback) {
  return once(IDLE_CALLBACK, idle, callback);
}

export function cancelIdleCallback(id) {
  clear(IDLE_CALLBACK, id);
}

export const setTimeoutAcrossTransitions = (...args) => window.setTimeout(...args);
export const setIntervalAcrossTransitions = (...args) => window.setInterval(...args);
export const requestAnimationFrameAcrossTransitions = callback =>
  window.requestAnimationFrame(callback);
export const requestIdleCallbackAcrossTransitions = callback => idle(callback);

/**
 * Clears every timer of the page, see PageTransitions.
 */
export function clearAll() {
  Object.keys(timers).forEach(type => {
    timers[type].forEach(id => cancel[type](id));
    timers[type].clear();
  });
}

export default {
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  requestAnimationFrame,
  cancelAnimationFrame,
  requestIdleCallback,
  cancelIdleCallback,
  setTimeoutAcrossTransitions,
  setIntervalAcrossTransitions,
  requestAnimationFrameAcrossTransitions,
  requestIdleCallbackAcrossTransitions,
  clearAll
};
