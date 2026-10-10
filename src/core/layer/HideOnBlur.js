import HideSources from './HideSources';

export default class HideOnBlur {
  constructor(layer) {
    this.layer = layer;
    this.subscriptions = [];
  }

  enable() {
    this.subscriptions = [
      this.layer.subscribe('blur', () => {
        window.requestAnimationFrame(() => this.layer.hide(HideSources.BLUR));
        return false;
      })
    ];
  }

  disable() {
    this.subscriptions.forEach(subscription => subscription.remove());
    this.subscriptions = [];
  }
}
