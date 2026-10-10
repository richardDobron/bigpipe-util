import Layer from './Layer';
import { getTabbable } from './focusWithinLayer';

export default class TabIsolation {
  constructor(layer) {
    this.layer = layer;
    this.subscription = null;
  }

  enable() {
    this.subscription = this.layer.subscribe('key', event => this.handle(event));
  }

  disable() {
    this.subscription.remove();
    this.subscription = null;
  }

  handle(event) {
    if (event.key !== 'Tab' || Layer.getTopmostLayer() !== this.layer) {
      return true;
    }

    const root = this.layer.getContentRoot();
    const items = getTabbable(root);

    if (!items.length) {
      root.focus();
      return false;
    }

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (!root.contains(active)) {
      first.focus();
      return false;
    }

    if (event.shiftKey && active === first) {
      last.focus();
      return false;
    }

    if (!event.shiftKey && active === last) {
      first.focus();
      return false;
    }

    return true;
  }
}
