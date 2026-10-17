import invariant from './invariant';
import { lockScroll, unlockScroll } from './layer/scrollLock';
import reportError from './reportError';
import { trustedHTML } from './trustedTypes';

// Class names may be lists ('opacity-0 transition-opacity'), for utility-first CSS like Tailwind.
const DEFAULTS = Object.freeze({
  el: null, // Markup on the page to show as the modal, or its selector. Built from the templates otherwise.
  appendTo: 'body', // Where the built modal goes, an element or a selector.
  animate: true, // Add `animateClass` while hidden and `animateInClass` while shown.
  animateClass: 'fade',
  animateInClass: 'show',
  openClass: 'modal-open', // On the body while a modal is open.
  backdrop: true, // false for none, 'static' for one that doesn't close the modal.
  keyboard: true, // Close with Escape.
  lockScroll: true, // Keep the page from scrolling, with inline styles.
  header: true,
  headerClose: true,
  title: false, // HTML or an element.
  content: false, // HTML or an element, the body.
  footer: false, // HTML or an element.
  label: '', // The aria-label of a modal without a title.
  transition: 300,
  backdropTransition: 150
});

const TEMPLATES = Object.freeze({
  container: '<div class="modal" tabindex="-1"></div>',
  dialog: '<div class="modal-dialog"></div>',
  content: '<div class="modal-content"></div>',
  header: '<div class="modal-header"></div>',
  title: '<h4 class="modal-title"></h4>',
  headerClose:
    '<button type="button" class="close" data-close aria-label="Close"><span aria-hidden="true">×</span></button>',
  body: '<div class="modal-body"></div>',
  footer: '<div class="modal-footer"></div>',
  backdrop: '<div class="modal-backdrop"></div>'
});

// The parts of markup on the page (the `el` option), and the elements that close the modal.
const SELECTORS = Object.freeze({
  dialog: '.modal-dialog',
  content: '.modal-content',
  header: '.modal-header',
  title: '.modal-title',
  body: '.modal-body',
  footer: '.modal-footer',
  dismiss: '[data-close], [data-dismiss="modal"]'
});

// Open modals, the last one on top.
const open = [];
let nextId = 1;

function build(html) {
  const template = document.createElement('template');
  template.innerHTML = trustedHTML(html.trim());
  return template.content.firstElementChild;
}

function classList(names) {
  return String(names || '')
    .split(/\s+/)
    .filter(Boolean);
}

function addClasses(element, names) {
  element.classList.add(...classList(names));
}

function removeClasses(element, names) {
  element.classList.remove(...classList(names));
}

function hasClasses(element, names) {
  const list = classList(names);
  return list.length > 0 && list.every(name => element.classList.contains(name));
}

function setContent(element, content) {
  if (content instanceof Node) {
    element.appendChild(content);
  } else {
    element.innerHTML = trustedHTML(String(content));
  }
}

function isSet(value) {
  return value !== false && value !== null && value !== undefined;
}

/**
 * A modal without dependencies. It sets no styles except `display`, the scroll lock and the classes
 * of the options, so Bootstrap, Tailwind or your own CSS style it: the templates, the selectors and
 * the class names can be replaced for all modals (`Modal.templates = {...}`) or for one.
 *
 * Events: `show`, `showBackdrop`, `shown`, `hide`, `hidden` with the modal, and `dismiss` with the
 * modal, the DOM event and the element that closed it, if any.
 */
export default class Modal {
  static set templates(templates) {
    this._baseTemplates = templates;
  }

  static get templates() {
    return { ...TEMPLATES, ...this._baseTemplates };
  }

  static set selectors(selectors) {
    this._baseSelectors = selectors;
  }

  static get selectors() {
    return { ...SELECTORS, ...this._baseSelectors };
  }

  static set options(options) {
    this._baseOptions = options;
  }

  static get options() {
    return { ...DEFAULTS, ...this._baseOptions };
  }

  static getTopmost() {
    return open[open.length - 1] || null;
  }

  constructor(options = {}) {
    const defaults = this.constructor;

    this.id = `modal_${(nextId++).toString(36)}`;
    this.el = null;
    this._html = {};
    this._listeners = {};
    this._timers = [];
    this._open = false;
    this._hiding = false;
    this._visible = false;
    this._locked = false;
    this._pressedOutside = null;
    this._options = { ...defaults.options, ...options };
    this._templates = { ...defaults.templates, ...options.templates };
    this._selectors = { ...defaults.selectors, ...options.selectors };

    this._onKeyDown = event => this._handleKeyDown(event);
    this._onMouseDown = event => {
      this._pressedOutside = this._isOutside(event.target);
    };
    this._onClick = event => this._handleClick(event);
    this._onBackdropClick = event => {
      if (this._options.backdrop === true) {
        this._dismiss(event, null);
      }
    };

    let { el } = this._options;
    if (typeof el === 'string') {
      const selector = el;
      el = document.querySelector(selector);
      invariant(el, 'Modal: element "%s" not found.', selector);
    }

    this._built = !el;
    if (el) {
      this._mapDom(el);
    } else {
      this._render();
    }
    this._setAria();
  }

  get backdrop() {
    return this._html.backdrop || null;
  }

  isShown() {
    return this._open && !this._hiding;
  }

  on(name, listener) {
    (this._listeners[name] = this._listeners[name] || []).push(listener);
    return this;
  }

  once(name, listener) {
    const wrapper = (...args) => {
      this.off(name, wrapper);
      listener.apply(this, args);
    };
    wrapper.listener = listener;
    return this.on(name, wrapper);
  }

  off(name, listener) {
    if (!listener) {
      delete this._listeners[name];
    } else if (this._listeners[name]) {
      this._listeners[name] = this._listeners[name].filter(
        callback => callback !== listener && callback.listener !== listener
      );
    }
    return this;
  }

  emit(name, ...args) {
    const listeners = this._listeners[name] || [];

    listeners.slice().forEach(listener => {
      try {
        listener.apply(this, args);
      } catch (error) {
        reportError(error);
      }
    });

    return listeners.length > 0;
  }

  addListener(name, listener) {
    return this.on(name, listener);
  }

  removeListener(name, listener) {
    return this.off(name, listener);
  }

  show() {
    if (this._open) {
      return this;
    }

    const o = this._options;
    const html = this._html;

    this._open = true;
    this.emit('show', this);

    if (this._built) {
      this._getAppendTo().appendChild(html.container);
    }

    open.push(this);
    // Before the class, which may hide the scrollbar that the lock measures.
    if (o.lockScroll) {
      lockScroll();
      this._locked = true;
    }
    addClasses(document.body, o.openClass);

    this._setDisplayed(true);
    html.container.scrollTop = 0;
    this._listen();

    const reveal = () => {
      if (o.animate) {
        void html.container.offsetWidth; // A reflow, so the transition runs.
      }
      addClasses(html.container, o.animateInClass);
      this._later(() => {
        this._visible = true;
        this.emit('shown', this);
      }, o.transition);
    };

    if (o.backdrop === false) {
      reveal();
      return this;
    }

    const backdrop = build(this._templates.backdrop);
    if (o.animate) {
      addClasses(backdrop, o.animateClass);
    }
    // Right below the modal, so it is under it even without a z-index.
    html.container.parentNode.insertBefore(backdrop, html.container);
    backdrop.addEventListener('click', this._onBackdropClick);
    html.backdrop = backdrop;

    if (o.animate) {
      void backdrop.offsetWidth;
    }
    addClasses(backdrop, o.animateInClass);

    this._later(() => {
      this.emit('showBackdrop', this);
      reveal();
    }, o.backdropTransition);

    return this;
  }

  hide() {
    if (!this._open || this._hiding) {
      return this;
    }

    const o = this._options;
    const html = this._html;

    this._hiding = true;
    this.emit('hide', this);

    // Hidden before it was shown completely: the rest of showing is skipped.
    this._clearTimers();
    this._unlisten();
    removeClasses(html.container, o.animateInClass);
    if (html.backdrop) {
      removeClasses(html.backdrop, o.animateInClass);
    }

    this._later(
      () => {
        if (html.backdrop) {
          html.backdrop.removeEventListener('click', this._onBackdropClick);
          html.backdrop.remove();
          html.backdrop = null;
        }

        this._setDisplayed(false);
        if (this._built) {
          html.container.remove();
        }

        open.splice(open.indexOf(this), 1);
        if (!open.length) {
          removeClasses(document.body, o.openClass);
        }
        if (this._locked) {
          unlockScroll();
          this._locked = false;
        }

        this._open = false;
        this._hiding = false;
        this._visible = false;
        this.emit('hidden', this);
      },
      Math.max(o.transition, o.backdrop === false ? 0 : o.backdropTransition)
    );

    return this;
  }

  toggle() {
    return this._open && !this._hiding ? this.hide() : this.show();
  }

  _render() {
    const o = this._options;
    const t = this._templates;
    const html = this._html;

    html.container = build(t.container);
    html.dialog = build(t.dialog);
    html.content = build(t.content);
    html.header = null;
    html.title = null;
    html.headerClose = null;
    html.body = null;
    html.footer = null;

    if (o.animate) {
      addClasses(html.container, o.animateClass);
    }

    if (o.header) {
      html.header = build(t.header);
      if (isSet(o.title) && o.title !== '') {
        html.title = build(t.title);
        setContent(html.title, o.title);
        html.header.appendChild(html.title);
      }
      if (o.headerClose) {
        html.headerClose = build(t.headerClose);
        html.header.appendChild(html.headerClose);
      }
      html.content.appendChild(html.header);
    }

    if (isSet(o.content)) {
      html.body = build(t.body);
      setContent(html.body, o.content);
      html.content.appendChild(html.body);
    }

    if (isSet(o.footer) && o.footer !== '') {
      html.footer = build(t.footer);
      setContent(html.footer, o.footer);
      html.content.appendChild(html.footer);
    }

    html.dialog.appendChild(html.content);
    html.container.appendChild(html.dialog);
    this.el = html.container;
  }

  _mapDom(el) {
    const s = this._selectors;
    const html = this._html;

    html.container = el;
    ['dialog', 'content', 'header', 'title', 'body', 'footer'].forEach(part => {
      html[part] = s[part] ? el.querySelector(s[part]) : null;
    });

    // Markup with the animation class is animated, as with Bootstrap.
    if (hasClasses(el, this._options.animateClass)) {
      this._options.animate = true;
    }

    this.el = el;
  }

  _setAria() {
    const { container, title } = this._html;

    if (!container.hasAttribute('role')) {
      container.setAttribute('role', 'dialog');
    }
    container.setAttribute('aria-modal', 'true');

    if (container.hasAttribute('aria-labelledby') || container.hasAttribute('aria-label')) {
      return;
    }
    if (title) {
      title.id = title.id || `${this.id}_title`;
      container.setAttribute('aria-labelledby', title.id);
    } else if (this._options.label) {
      container.setAttribute('aria-label', this._options.label);
    }
  }

  _getAppendTo() {
    const { appendTo } = this._options;
    const parent = typeof appendTo === 'string' ? document.querySelector(appendTo) : appendTo;
    return parent || document.body;
  }

  _setDisplayed(displayed) {
    const { style } = this._html.container;

    if (!displayed) {
      style.display = 'none';
      return;
    }

    // Your CSS may display it as flex or grid; `block` only when it hides it.
    style.display = '';
    if (window.getComputedStyle(this._html.container).display === 'none') {
      style.display = 'block';
    }
  }

  _listen() {
    const { container } = this._html;

    document.addEventListener('keydown', this._onKeyDown);
    container.addEventListener('mousedown', this._onMouseDown);
    container.addEventListener('click', this._onClick);
  }

  _unlisten() {
    const { container } = this._html;

    document.removeEventListener('keydown', this._onKeyDown);
    container.removeEventListener('mousedown', this._onMouseDown);
    container.removeEventListener('click', this._onClick);
  }

  // Outside of the box of the modal, on the part of the container that covers the page.
  _isOutside(target) {
    const box = this._html.content || this._html.dialog;
    return box ? !box.contains(target) : target === this._html.container;
  }

  _handleClick(event) {
    const { target } = event;
    const pressedOutside = this._pressedOutside;
    this._pressedOutside = null;

    const dismiss = target instanceof Element ? target.closest(this._selectors.dismiss) : null;
    if (dismiss && this.el.contains(dismiss)) {
      if (dismiss.tagName === 'A' || dismiss.tagName === 'AREA') {
        event.preventDefault();
      }
      this._dismiss(event, dismiss);
      return;
    }

    // A text selection that started inside and ended outside doesn't count.
    if (this._options.backdrop === true && pressedOutside !== false && this._isOutside(target)) {
      this._dismiss(event, null);
    }
  }

  _handleKeyDown(event) {
    const { keyboard } = this._options;

    // A dialog gives Escape to its layer instead, see DialogLayer: a layer above it gets it first.
    if (this.layer || !keyboard || event.key !== 'Escape' || Modal.getTopmost() !== this) {
      return;
    }

    this._dismiss(event, null);
  }

  _dismiss(event, element) {
    this.emit('dismiss', this, event, element);
    this.hide();
  }

  _later(callback, delay) {
    const timer = setTimeout(() => {
      this._timers.splice(this._timers.indexOf(timer), 1);
      callback();
    }, delay);
    this._timers.push(timer);
  }

  _clearTimers() {
    this._timers.forEach(timer => clearTimeout(timer));
    this._timers = [];
  }
}
