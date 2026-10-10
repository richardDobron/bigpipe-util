import { prefersReducedMotion } from './motion';

export default class FadeOnShow {
  static forDuration(duration) {
    return class extends FadeOnShow {
      getDuration() {
        return duration;
      }
    };
  }

  constructor(layer) {
    this.layer = layer;
    this.subscriptions = [];
    this.timer = null;
  }

  getDuration() {
    return 100;
  }

  enable() {
    this.subscriptions = [
      this.layer.subscribe('beforeshow', () => {
        if (!prefersReducedMotion()) {
          this.layer.getRoot().style.opacity = '0';
        }
      }),
      this.layer.subscribe('show', () => this.fadeIn())
    ];
  }

  disable() {
    clearTimeout(this.timer);
    this.subscriptions.forEach(subscription => subscription.remove());
    this.subscriptions = [];
  }

  fadeIn() {
    const { style } = this.layer.getRoot();

    if (prefersReducedMotion()) {
      style.opacity = '';
      return;
    }

    const duration = this.getDuration();
    style.transition = `opacity ${duration}ms`;
    window.requestAnimationFrame(() => {
      style.opacity = '1';
    });

    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      style.transition = '';
      style.opacity = '';
    }, duration);
  }
}
