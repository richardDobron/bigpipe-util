import Layer from './Layer';
import { getTabbable } from './focusWithinLayer';

// The shown layers with TabIsolation: the last one keeps Tab, also under layers that don't.
const isolations = [];

export default class TabIsolation {
  constructor(layer) {
    this.layer = layer;
    this.subscriptions = [];
  }

  enable() {
    this.subscriptions = [
      this.layer.subscribe('key', event => this.handle(event)),
      this.layer.subscribe('show', () => this.add()),
      this.layer.subscribe('hide', () => this.remove())
    ];

    if (this.layer.isShown()) {
      this.add();
    }
  }

  disable() {
    this.subscriptions.forEach(subscription => subscription.remove());
    this.subscriptions = [];
    this.remove();
  }

  add() {
    this.remove();
    isolations.push(this);
  }

  remove() {
    const index = isolations.indexOf(this);
    if (index !== -1) {
      isolations.splice(index, 1);
    }
  }

  handle(event) {
    if (event.key !== 'Tab' || isolations[isolations.length - 1] !== this) {
      return true;
    }

    const root = this.layer.getContentRoot();
    const active = document.activeElement;

    if (!root.contains(active) && Layer.containsIncludingLayers(root, active)) {
      return this.handleOpenedLayer(event, active);
    }

    const items = getTabbable(root);

    if (!items.length) {
      root.focus();
      return false;
    }

    const first = items[0];
    const last = items[items.length - 1];

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

  // The focus is in a layer opened from inside of this one, e.g. a menu in the body: Tab moves
  // through it, and from its ends back to the element it was opened from.
  handleOpenedLayer(event, active) {
    const items = getTabbable(Layer.getLayerContaining(active).getContentRoot());
    const index = items.indexOf(active);

    if (index !== -1 && index !== (event.shiftKey ? 0 : items.length - 1)) {
      return true;
    }

    const target =
      index === -1 && items.length
        ? items[event.shiftKey ? items.length - 1 : 0]
        : Layer.getCausalElementOf(active);
    target.focus();
    return false;
  }
}
