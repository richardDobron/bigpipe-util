import reportError from './reportError';
import Run from './Run';

const DEFAULT_MESSAGE = 'You have unsaved changes.';

function serialize(form) {
  return JSON.stringify(
    Array.from(new FormData(form), ([name, value]) => [
      name,
      typeof value === 'string' ? value : `file:${value.name}:${value.size}`
    ])
  );
}

export default class FormMonitor {
  constructor(form, { message = DEFAULT_MESSAGE, warn = true } = {}) {
    this.form = form;
    this.message = message;
    this.listeners = new Map();
    this.original = serialize(form);
    this.dirty = false;
    this.destroyed = false;

    this.check = () => {
      this.inform('change');
      this.setDirty(serialize(this.form) !== this.original);
    };
    this.onReset = () => setTimeout(this.check, 0);
    this.onSubmit = event => {
      if (this.form.getAttribute('rel') === 'async') {
        return;
      }
      Promise.resolve().then(() => {
        if (!event.defaultPrevented) {
          this.reset();
        }
      });
    };
    this.onSuccess = event => {
      if (event.target === this.form) {
        this.reset();
      }
    };

    ['input', 'change'].forEach(type => form.addEventListener(type, this.check));
    form.addEventListener('reset', this.onReset);
    form.addEventListener('submit', this.onSubmit);
    form.addEventListener('success', this.onSuccess);

    this.hooks = [Run.onCleanupOrLeave(form, () => this.destroy())];
    if (warn) {
      this.hooks.push(Run.onBeforeUnload(() => (this.dirty ? this.getMessage() : null)));
    }
  }

  getMessage() {
    return typeof this.message === 'function' ? this.message(this.form) : this.message;
  }

  subscribe(name, callback) {
    if (!this.listeners.has(name)) {
      this.listeners.set(name, new Set());
    }
    this.listeners.get(name).add(callback);

    return { remove: () => this.listeners.get(name).delete(callback) };
  }

  inform(name) {
    Array.from(this.listeners.get(name) || []).forEach(callback => {
      try {
        callback(this);
      } catch (error) {
        reportError(error);
      }
    });
  }

  isDirty() {
    return this.dirty;
  }

  reset() {
    this.original = serialize(this.form);
    this.setDirty(false);
  }

  setDirty(dirty) {
    if (dirty !== this.dirty) {
      this.dirty = dirty;
      this.inform(dirty ? 'dirty' : 'clean');
    }
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;

    ['input', 'change'].forEach(type => this.form.removeEventListener(type, this.check));
    this.form.removeEventListener('reset', this.onReset);
    this.form.removeEventListener('submit', this.onSubmit);
    this.form.removeEventListener('success', this.onSuccess);
    this.hooks.forEach(hook => hook.remove());
    this.listeners.clear();
    this.dirty = false;
  }
}
