const TABBABLE =
  'a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

export function getTabbable(root) {
  return Array.from(root.querySelectorAll(TABBABLE)).filter(
    element =>
      !element.disabled &&
      !element.closest('[hidden],[inert]') &&
      element.getAttribute('type') !== 'hidden' &&
      element.getAttribute('tabindex') !== '-1'
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
