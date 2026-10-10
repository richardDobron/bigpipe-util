export default class DestroyOnHide {
  constructor(layer) {
    this.layer = layer;
    this.subscription = null;
  }

  enable() {
    this.subscription = this.layer.subscribe('hide', () => {
      setTimeout(() => this.layer.destroy(), 0);
    });
  }

  disable() {
    this.subscription.remove();
    this.subscription = null;
  }
}
