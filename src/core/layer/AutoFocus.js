import focusWithinLayer from './focusWithinLayer';

export default class AutoFocus {
  constructor(layer) {
    this.layer = layer;
    this.subscription = null;
  }

  enable() {
    this.subscription = this.layer.subscribe('aftershow', () => {
      focusWithinLayer(this.layer.getFocusRoot());
    });
  }

  disable() {
    this.subscription.remove();
    this.subscription = null;
  }
}
