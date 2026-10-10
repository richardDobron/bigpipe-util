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

    const target = this.layer.getCausalElement() || this.opener;
    if (target && target.isConnected && typeof target.focus === 'function') {
      target.focus();
    }
  }
}
