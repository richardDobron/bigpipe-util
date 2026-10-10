import DataStore from '../DataStore';
import invariant from '../invariant';
import reportError from '../reportError';

const layers = [];
const globalListeners = new Map();
let listening = false;
let mouseDownTarget = null;
let mouseUpTarget = null;

function subscribe(listeners, names, callback) {
  const list = Array.isArray(names) ? names : [names];

  list.forEach(name => {
    if (!listeners.has(name)) {
      listeners.set(name, []);
    }
    listeners.get(name).push(callback);
  });

  let active = true;
  return {
    remove() {
      if (!active) {
        return;
      }
      active = false;
      list.forEach(name => {
        const callbacks = listeners.get(name);
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
          callbacks.splice(index, 1);
        }
      });
    }
  };
}

function inform(listeners, name, data) {
  let result = true;

  Array.from(listeners.get(name) || []).forEach(callback => {
    try {
      if (callback(data, name) === false) {
        result = false;
      }
    } catch (error) {
      reportError(error);
    }
  });

  return result;
}

function createRoot(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

function containsIncludingLayers(root, target) {
  if (root.contains(target)) {
    return true;
  }

  return layers.some(layer => {
    const causal = layer.getCausalElement();
    const element = layer.getRoot();
    return element && causal && root.contains(causal) && element.contains(target);
  });
}

function onKeyDown(event) {
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    if (layers[i].inform('key', event) === false) {
      event.preventDefault();
      return;
    }
  }
}

function onMouseDown(event) {
  mouseDownTarget = event.target;
}

function onMouseUp(event) {
  mouseUpTarget = event.target;
  setTimeout(() => {
    mouseDownTarget = null;
    mouseUpTarget = null;
  }, 0);
}

function onClick(event) {
  const { target } = event;
  const downTarget = mouseDownTarget;
  const upTarget = mouseUpTarget;
  mouseDownTarget = null;
  mouseUpTarget = null;

  if (!layers.length || target !== downTarget || target !== upTarget) {
    return;
  }

  if (!document.documentElement.contains(target)) {
    return;
  }

  Layer.informBlur(target);
}

function listen() {
  if (listening || typeof document === 'undefined') {
    return;
  }
  listening = true;

  const root = document.documentElement;
  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('mousedown', onMouseDown);
  root.addEventListener('mouseup', onMouseUp);
  root.addEventListener('click', onClick);
}

export default class Layer {
  static subscribe(name, callback) {
    return subscribe(globalListeners, name, callback);
  }

  static inform(name, data) {
    return inform(globalListeners, name, data);
  }

  static getTopmostLayer() {
    return layers[layers.length - 1];
  }

  static getLayerOf(element) {
    return DataStore.get(element, 'layer');
  }

  static informBlur(target) {
    for (let i = layers.length - 1; i >= 0; i -= 1) {
      const layer = layers[i];

      if (containsIncludingLayers(layer.getContentRoot(), target)) {
        return;
      }

      if (layer.inform('blur', { target }) === false || layer.isShown()) {
        return;
      }
    }
  }

  constructor(root, config = {}) {
    this.config = config;
    this.listeners = new Map();
    this.behaviors = new Map();
    this.root = typeof root === 'string' ? createRoot(root) : root;
    this.causalElement = config.causalElement || null;
    this.insertParent = config.insertParent || null;
    this.permanent = Boolean(config.permanent);
    this.shown = false;
    this.hiding = false;
    this.destroyed = false;

    invariant(this.root instanceof Element, 'Layer: a DOM node or HTML is required.');

    (config.classNames || []).forEach(name => this.root.classList.add(name));
    Object.keys(config.attributes || {}).forEach(name =>
      this.root.setAttribute(name, config.attributes[name])
    );

    if (this.root.isConnected) {
      this.root.style.display = 'none';
    }

    DataStore.set(this.root, 'layer', this);
    this.enableBehaviors(this.getDefaultBehaviors().concat(config.behaviors || []));
  }

  getDefaultBehaviors() {
    return [];
  }

  subscribe(names, callback) {
    return subscribe(this.listeners, names, callback);
  }

  inform(name, data) {
    return inform(this.listeners, name, data);
  }

  enableBehaviors(behaviors) {
    behaviors.forEach(Behavior => {
      if (!this.behaviors.has(Behavior)) {
        const behavior = new Behavior(this);
        this.behaviors.set(Behavior, behavior);
        behavior.enable();
      }
    });
    return this;
  }

  disableBehaviors(behaviors) {
    behaviors.forEach(Behavior => {
      const behavior = this.behaviors.get(Behavior);
      if (behavior) {
        this.behaviors.delete(Behavior);
        behavior.disable();
      }
    });
    return this;
  }

  hasBehavior(Behavior) {
    return this.behaviors.has(Behavior);
  }

  getRoot() {
    return this.root;
  }

  getContentRoot() {
    return this.getRoot();
  }

  getFocusRoot() {
    return this.getRoot();
  }

  getCausalElement() {
    return this.causalElement;
  }

  setCausalElement(element) {
    this.causalElement = element;
    return this;
  }

  getInsertParent() {
    return this.insertParent || document.body;
  }

  setInsertParent(parent) {
    if (parent) {
      this.insertParent = parent;
      if (this.shown) {
        parent.appendChild(this.root);
        this.updatePosition();
      }
    }
    return this;
  }

  isShown() {
    return this.shown;
  }

  updatePosition() {
    return true;
  }

  setDisplayed(displayed) {
    const { style } = this.root;

    if (displayed) {
      style.display = '';
      if (window.getComputedStyle(this.root).display === 'none') {
        style.display = 'block';
      }
    } else {
      style.display = 'none';
    }
  }

  show() {
    if (this.shown) {
      return this;
    }

    invariant(this.root, 'Layer: the layer was destroyed.');
    this.inform('beforeshow');

    this.root.style.visibility = 'hidden';
    this.setDisplayed(true);
    this.getInsertParent().appendChild(this.root);

    const positioned = this.updatePosition() !== false;
    if (positioned) {
      this.markShown();
    } else {
      this.setDisplayed(false);
    }

    this.root.style.visibility = '';

    if (positioned) {
      this.inform('aftershow');
    }

    return this;
  }

  markShown() {
    listen();
    this.shown = true;
    this.inform('show');
    Layer.inform('show', this);

    if (!this.permanent) {
      // Not before the event that opened the layer is over, or it would count as a click outside.
      setTimeout(() => {
        if (this.shown && !layers.includes(this)) {
          layers.push(this);
        }
      }, 0);
    }
  }

  hide(source) {
    if (this.hiding || !this.shown || this.inform('beforehide', source) === false) {
      return this;
    }

    this.hiding = true;
    if (this.inform('starthide', source) !== false) {
      this.finishHide();
    }

    return this;
  }

  conditionShow(condition) {
    return condition ? this.show() : this.hide();
  }

  finishHide() {
    if (!this.shown) {
      return;
    }

    this.setDisplayed(false);
    this.markHidden();
  }

  markHidden() {
    const index = layers.indexOf(this);
    if (index !== -1) {
      layers.splice(index, 1);
    }

    this.hiding = false;
    this.shown = false;
    this.inform('hide');
    Layer.inform('hide', this);
  }

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.finishHide();
    this.root.remove();
    this.behaviors.forEach(behavior => behavior.disable());
    this.behaviors.clear();
    this.inform('destroy');
    Layer.inform('destroy', this);
    DataStore.remove(this.root, 'layer');
    this.destroyed = true;
  }
}
