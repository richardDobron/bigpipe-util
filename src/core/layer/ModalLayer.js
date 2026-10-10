const DEFAULTS = Object.freeze({
  backdropClassName: '',
  backdropStyle: null,
  zIndex: 1000,
  center: true,
  lockScroll: true
});

const stack = [];
let scrollLock = null;

function lock() {
  if (scrollLock) {
    return;
  }

  const { body, documentElement } = document;
  scrollLock = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };

  const scrollbar = window.innerWidth - documentElement.clientWidth;
  if (scrollbar > 0) {
    body.style.paddingRight = `${(parseFloat(window.getComputedStyle(body).paddingRight) || 0) + scrollbar}px`;
  }
  body.style.overflow = 'hidden';
}

function unlock() {
  if (!scrollLock) {
    return;
  }

  document.body.style.overflow = scrollLock.overflow;
  document.body.style.paddingRight = scrollLock.paddingRight;
  scrollLock = null;
}

function restack() {
  stack.forEach((modal, index) => {
    const { zIndex } = modal.getOptions();
    const top = index === stack.length - 1;

    modal.backdrop.style.zIndex = String(zIndex + index * 10);
    modal.backdrop.style.display = top ? '' : 'none';
    modal.layer.getRoot().style.zIndex = String(zIndex + index * 10 + 1);
  });
}

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
      lock();
    }
    restack();
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

    style.zIndex = '';
    if (options.center) {
      ['position', 'top', 'left', 'transform', 'maxWidth', 'maxHeight', 'overflow'].forEach(name => {
        style[name] = '';
      });
    }

    if (!stack.length) {
      unlock();
    }
    restack();
  }
}
