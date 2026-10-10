import Arbiter from './Arbiter';
import reportError from './reportError';

export const KEYS = Object.freeze({
  BACKSPACE: 'Backspace',
  TAB: 'Tab',
  RETURN: 'Enter',
  ESCAPE: 'Escape',
  SPACE: ' ',
  LEFT: 'ArrowLeft',
  UP: 'ArrowUp',
  RIGHT: 'ArrowRight',
  DOWN: 'ArrowDown',
  DELETE: 'Delete',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
  HOME: 'Home',
  END: 'End',
  COMMA: ',',
  PERIOD: '.',
  SLASH: '/'
});

// Keys that still work as shortcuts in an empty text field.
const NAVIGATION_KEYS = new Set([
  'Backspace',
  'Tab',
  'Enter',
  'Escape',
  ' ',
  'ArrowLeft',
  'ArrowUp',
  'ArrowRight',
  'ArrowDown',
  'Delete'
]);

let handlers = null;

function normalize(key) {
  const text = String(key);
  return KEYS[text.toUpperCase()] || (text.length === 1 ? text.toLowerCase() : text);
}

function isInteractive(element) {
  return (
    element instanceof Element &&
    (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.nodeName))
  );
}

function isEmpty(element) {
  return (element.isContentEditable ? element.textContent : element.value || '').length === 0;
}

function onKeyEvent(type, event) {
  const list = handlers.get(normalize(event.key || ''));
  if (!list) {
    return;
  }

  for (const handler of list.slice()) {
    try {
      if (
        (!handler.filter || handler.filter(event, type)) &&
        handler.callback(event, type) === false
      ) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    } catch (error) {
      reportError(error);
    }
  }
}

function resetHandlers() {
  handlers.forEach((list, key) => {
    const kept = list.filter(handler => handler.preserve);
    if (kept.length > 0) {
      handlers.set(key, kept);
    } else {
      handlers.delete(key);
    }
  });
}

function getHandlers() {
  if (!handlers) {
    handlers = new Map();
    ['keydown', 'keyup', 'keypress'].forEach(type =>
      document.addEventListener(type, event => onKeyEvent('on' + type, event))
    );
    new Arbiter().subscribe('page_transition', resetHandlers);
  }
  return handlers;
}

function register(key, callback, filter, replace, preserve) {
  const all = getHandlers();
  const name = normalize(key);
  const handler = { callback, filter, preserve };

  if (replace || !all.has(name)) {
    all.set(name, []);
  }
  all.get(name).push(handler);

  return {
    remove() {
      const list = all.get(name);
      const index = list ? list.indexOf(handler) : -1;
      if (index !== -1) {
        list.splice(index, 1);
      }
    }
  };
}

/**
 * Keyboard shortcuts of the page. A shortcut is a key name of KEYS, e.g. 'ESCAPE', or a character,
 * e.g. 'j' or '/'. Its callback gets the event and the type ('onkeydown', 'onkeyup',
 * 'onkeypress'); returning false prevents the default action and stops the other callbacks.
 */
const KeyEventController = {
  KEYS,

  /**
   * Registers a shortcut of the current page: a page transition removes it. The filter decides
   * which events call it, by default defaultFilter(). With `replace`, it replaces the other
   * shortcuts of the key. Returns a subscription whose `remove()` removes it.
   */
  registerKey(key, callback, filter = KeyEventController.defaultFilter, replace = false) {
    return register(key, callback, filter, replace, false);
  },

  registerKeyAcrossTransitions(
    key,
    callback,
    filter = KeyEventController.defaultFilter,
    replace = false
  ) {
    return register(key, callback, filter, replace, true);
  },

  /**
   * Accepts a keydown without Ctrl, Alt or Meta that is not repeated and does not happen in a
   * text field, select or editable element, except for navigation keys like ESCAPE in an empty
   * one, so typing never triggers a shortcut.
   */
  defaultFilter(event, type) {
    if (type !== 'onkeydown' || event.ctrlKey || event.altKey || event.metaKey || event.repeat) {
      return false;
    }

    const { target } = event;
    return !isInteractive(target) || (NAVIGATION_KEYS.has(event.key) && isEmpty(target));
  }
};

export default KeyEventController;
