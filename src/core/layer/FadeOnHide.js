import { prefersReducedMotion } from './motion';

export default class FadeOnHide {
  static forDuration(duration) {
    return class extends FadeOnHide {
      getDuration() {
        return duration;
      }
    };
  }

  constructor(layer) {
    this.layer = layer;
    this.subscription = null;
    this.timer = null;
  }

  getDuration() {
    return 150;
  }

  enable() {
    this.subscription = this.layer.subscribe('starthide', () => this.fadeOut());
  }

  disable() {
    clearTimeout(this.timer);
    this.subscription.remove();
    this.subscription = null;
  }

  fadeOut() {
    if (prefersReducedMotion()) {
      return true;
    }

    const { style } = this.layer.getRoot();
    const duration = this.getDuration();

    style.transition = `opacity ${duration}ms`;
    style.opacity = '0';

    this.timer = setTimeout(() => {
      style.transition = '';
      style.opacity = '';
      this.layer.finishHide();
    }, duration);

    return false;
  }
}
