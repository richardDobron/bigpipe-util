const TABBABLE =
  'a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

// From the computed styles rather than the layout, so that it works without one (jsdom) too.
function isDisplayed(element, cache) {
  if (!element) {
    return true;
  }

  if (!cache.has(element)) {
    cache.set(
      element,
      window.getComputedStyle(element).display !== 'none' &&
        isDisplayed(element.parentElement, cache)
    );
  }
  return cache.get(element);
}

/**
 * Whether the element is displayed and not invisible. `cache` keeps the ancestors that were checked,
 * for checking many elements.
 */
export function isVisible(element, cache = new Map()) {
  // visibility is inherited, unlike display.
  return (
    !['hidden', 'collapse'].includes(window.getComputedStyle(element).visibility) &&
    isDisplayed(element, cache)
  );
}

export function getTabbable(root) {
  const displayed = new Map();

  return Array.from(root.querySelectorAll(TABBABLE)).filter(
    element =>
      !element.disabled &&
      !element.closest('[hidden],[inert]') &&
      element.getAttribute('type') !== 'hidden' &&
      element.getAttribute('tabindex') !== '-1' &&
      isVisible(element, displayed)
  );
}

export default function focusWithinLayer(root) {
  let target = root.querySelector('[autofocus]');

  if (!target) {
    if (root.contains(document.activeElement) && document.activeElement !== root) {
      return;
    }

    target = getTabbable(root).find(
      element => element.tagName !== 'A' || element.getAttribute('role') === 'button'
    );
  }

  if (target) {
    target.focus();
    return;
  }

  if (!root.hasAttribute('tabindex')) {
    root.setAttribute('tabindex', '-1');
  }
  root.focus();
}
