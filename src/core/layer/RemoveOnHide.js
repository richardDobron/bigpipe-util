export default class RemoveOnHide {
  constructor(layer) {
    this.layer = layer;
    this.subscription = null;
  }

  enable() {
    this.subscription = this.layer.subscribe('hide', () => this.layer.getRoot().remove());
  }

  disable() {
    this.subscription.remove();
    this.subscription = null;
  }
}
