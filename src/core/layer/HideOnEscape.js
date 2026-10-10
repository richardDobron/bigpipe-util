import HideSources from './HideSources';

export default class HideOnEscape {
  constructor(layer) {
    this.layer = layer;
    this.subscription = null;
  }

  enable() {
    this.subscription = this.layer.subscribe('key', event => {
      if (event.key === 'Escape') {
        this.layer.hide(HideSources.ESCAPE);
        return false;
      }
      return true;
    });
  }

  disable() {
    this.subscription.remove();
    this.subscription = null;
  }
}
