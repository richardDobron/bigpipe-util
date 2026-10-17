import { addToStack, removeFromStack } from './overlayStack';
import { lockScroll, unlockScroll } from './scrollLock';

const DEFAULTS = Object.freeze({
  backdropClassName: '',
  backdropStyle: null,
  zIndex: 1000,
  center: true,
  lockScroll: true
});

const stack = [];

export default class ModalLayer {
  static configure(options) {
    return class extends ModalLayer {
      getOptions() {
        return { ...DEFAULTS, ...options };
      }
    };
  }

  static getTopmostModal() {
    return stack[stack.length - 1];
  }

  constructor(layer) {
    this.layer = layer;
    this.subscriptions = [];
    this.backdrop = null;
    this.entry = null;
    this.locked = false;
  }

  getOptions() {
    return DEFAULTS;
  }

  enable() {
    this.subscriptions = [
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
    if (this.backdrop) {
      return;
    }

    const options = this.getOptions();
    const root = this.layer.getRoot();
    const backdrop = document.createElement('div');

    if (options.backdropClassName) {
      backdrop.className = options.backdropClassName;
    } else {
      Object.assign(backdrop.style, {
        position: 'fixed',
        top: '0',
        right: '0',
        bottom: '0',
        left: '0',
        background: 'rgba(0, 0, 0, 0.5)'
      });
    }
    Object.assign(backdrop.style, options.backdropStyle);

    if (options.center) {
      Object.assign(root.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '100vw',
        maxHeight: '100vh',
        overflow: 'auto'
      });
    }

    root.parentNode.insertBefore(backdrop, root);
    this.backdrop = backdrop;
    stack.push(this);

    if (options.lockScroll) {
      lockScroll();
      this.locked = true;
    }

    // Stacked together with the dialogs.
    this.entry = { zIndex: options.zIndex, root, getBackdrop: () => this.backdrop };
    addToStack(this.entry);
  }

  remove() {
    if (!this.backdrop) {
      return;
    }

    const options = this.getOptions();
    const { style } = this.layer.getRoot();

    this.backdrop.remove();
    this.backdrop = null;
    stack.splice(stack.indexOf(this), 1);
    removeFromStack(this.entry);
    this.entry = null;
    if (options.center) {
      ['position', 'top', 'left', 'transform', 'maxWidth', 'maxHeight', 'overflow'].forEach(
        name => {
          style[name] = '';
        }
      );
    }

    if (this.locked) {
      unlockScroll();
      this.locked = false;
    }
  }
}
