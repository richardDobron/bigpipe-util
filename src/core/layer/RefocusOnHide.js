import Layer from './Layer';
import { isVisible } from './focusWithinLayer';

// The element itself, or else the closest one that is still on the page and visible, through the
// layers it is in (a menu item of a hidden menu gives the button that opened the menu).
function getRefocusTarget(element) {
  const seen = new Set();
  let target = element;

  while (target && !(target.isConnected && isVisible(target)) && !seen.has(target)) {
    seen.add(target);
    target = Layer.getCausalElementOf(target) || target.parentElement;
  }

  return target && target.isConnected && target !== document.body && !seen.has(target)
    ? target
    : null;
}

export default class RefocusOnHide {
  constructor(layer) {
    this.layer = layer;
    this.subscriptions = [];
    this.opener = null;
  }

  enable() {
    this.subscriptions = [
      this.layer.subscribe('beforeshow', () => {
        this.opener = document.activeElement;
      }),
      this.layer.subscribe('hide', () => this.refocus())
    ];
  }

  disable() {
    this.subscriptions.forEach(subscription => subscription.remove());
    this.subscriptions = [];
    this.opener = null;
  }

  refocus() {
    const active = document.activeElement;
    const root = this.layer.getRoot();

    if (active && active !== document.body && !root.contains(active)) {
      return;
    }

    const target = getRefocusTarget(this.layer.getCausalElement() || this.opener);
    if (target && typeof target.focus === 'function') {
      // Like a container the focus falls back to, which takes it only with a tabindex.
      if (target.tabIndex < 0 && !target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
      }
      target.focus();
    }
  }
}
