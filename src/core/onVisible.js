/**
 * Calls `callback` once, when `element` comes within `buffer` pixels of the viewport, e.g. to load
 * content right before the user scrolls to it. Returns a subscription whose `remove()` stops
 * waiting.
 *
 * Without IntersectionObserver, the callback is called right away (asynchronously).
 */
export default function onVisible(element, callback, { buffer = 0 } = {}) {
  if (typeof IntersectionObserver === 'undefined') {
    const timer = setTimeout(() => callback(element), 0);
    return { remove: () => clearTimeout(timer) };
  }

  let observer = new IntersectionObserver(
    entries => {
      if (!entries.some(entry => entry.isIntersecting)) {
        return;
      }

      observer.disconnect();
      observer = null;
      callback(element);
    },
    { rootMargin: `${buffer}px` }
  );
  observer.observe(element);

  return {
    remove() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    }
  };
}
