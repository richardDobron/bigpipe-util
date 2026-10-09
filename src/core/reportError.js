/**
 * Rethrows the error asynchronously: it reaches the console, window.onerror and error trackers,
 * while the code that caught it keeps running.
 */
export default function reportError(error) {
  setTimeout(() => {
    throw error;
  }, 0);
}
