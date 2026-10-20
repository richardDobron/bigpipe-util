import AsyncRequest from '../async/AsyncRequest';
import ContextualLayer from './layer/ContextualLayer';
import HideOnTransition from './layer/HideOnTransition';
import { trustedHTML } from './trustedTypes';

const DEFAULT_STYLE = {
  backgroundColor: '#1f2937',
  color: '#fff',
  borderRadius: '4px',
  padding: '4px 8px',
  fontSize: '12px',
  lineHeight: '1.4',
  maxWidth: '320px',
  overflowWrap: 'break-word'
};
const GAP = 6;
const OPPOSITE = { above: 'below', below: 'above', left: 'right', right: 'left' };

const tooltips = new WeakMap();
let options = {};
let layer = null;
let tooltipId = null;
let active = null;
let shown = null;
let delayTimer = null;
let listening = false;

function getLayer() {
  if (!layer) {
    tooltipId = 'tooltip_' + Math.random().toString(36).slice(2, 10);
    layer = new ContextualLayer(`<div role="tooltip" id="${tooltipId}"></div>`, {
      behaviors: [HideOnTransition]
    });
    layer.subscribe('hide', () => release());
    layer.subscribe('key', event => {
      if (event.key === 'Escape') {
        Tooltip.hide();
        return false;
      }
      return true;
    });
    layer.subscribe('reposition', () => {
      const { style } = layer.getRoot();
      if (options.zIndex !== undefined && !(Number(style.zIndex) > options.zIndex)) {
        style.zIndex = String(options.zIndex);
      }
    });
    applyLook();
  }
  return layer;
}

function applyLook() {
  const root = layer.getRoot();
  root.className = options.className || '';
  root.removeAttribute('style');
  root.style.display = 'none';
  root.style.pointerEvents = 'none';
  root.style.whiteSpace = 'pre-line';
  if (!options.className) {
    Object.assign(root.style, DEFAULT_STYLE);
  }
}

function findContext(target) {
  for (let node = target; node && node.nodeType === 1; node = node.parentElement) {
    if (tooltips.has(node)) {
      return node;
    }
  }
  return null;
}

function setContent(root, content) {
  if (content instanceof Node) {
    root.replaceChildren(content);
  } else if (content && typeof content.__html === 'string') {
    const template = document.createElement('template');
    template.innerHTML = trustedHTML(content.__html);
    root.replaceChildren(template.content);
  } else {
    root.textContent = String(content);
  }
}

function describe(context) {
  const ids = (context.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
  if (!ids.includes(tooltipId)) {
    context.setAttribute('aria-describedby', ids.concat(tooltipId).join(' '));
  }
}

function release() {
  if (!shown) {
    return;
  }
  const ids = (shown.getAttribute('aria-describedby') || '')
    .split(/\s+/)
    .filter(id => id && id !== tooltipId);
  if (ids.length) {
    shown.setAttribute('aria-describedby', ids.join(' '));
  } else {
    shown.removeAttribute('aria-describedby');
  }
  shown = null;
}

function clearDelay() {
  clearTimeout(delayTimer);
  delayTimer = null;
}

function fetchContent(context, data) {
  const { uri } = data;
  data.uri = null;

  new AsyncRequest(uri)
    .setMethod('GET')
    .setHandler(response => {
      if (response.payload !== null && response.payload !== undefined) {
        data.content = response.payload;
      }
      if (active === context && !delayTimer) {
        Tooltip.show(context);
      }
    })
    .setErrorHandler(() => {})
    .send();
}

function enter(target) {
  const context = findContext(target);
  if (context === active) {
    return;
  }

  Tooltip.hide();
  if (!context) {
    return;
  }

  active = context;
  const data = tooltips.get(context);
  if (data.uri) {
    fetchContent(context, data);
  }

  const delay = data.delay ?? options.delay ?? 0;
  if (delay > 0) {
    delayTimer = setTimeout(() => {
      delayTimer = null;
      Tooltip.show(context);
    }, delay);
  } else {
    Tooltip.show(context);
  }
}

function listen() {
  if (listening || typeof document === 'undefined') {
    return;
  }
  listening = true;

  const root = document.documentElement;
  root.addEventListener('mouseover', event => enter(event.target));
  root.addEventListener('focusin', event => enter(event.target));
  root.addEventListener('focusout', event => {
    if (active && !active.contains(event.relatedTarget)) {
      Tooltip.hide();
    }
  });
  root.addEventListener('click', event => {
    if (active && active.contains(event.target) && !tooltips.get(active).persistOnClick) {
      Tooltip.hide();
    }
  });
  window.addEventListener(
    'scroll',
    event => {
      if (shown && event.target !== layer.getRoot()) {
        Tooltip.hide();
      }
    },
    true
  );
}

/**
 * One tooltip for the whole page, shown next to an element while the pointer is over it or it
 * has the focus.
 */
const Tooltip = {
  /**
   * Sets the tooltip of an element: text (new lines are kept), a DOM node or `{__html}`.
   * Options: `position` (above, below, left, right), `alignment` (start, center, end), `delay`
   * in ms, `className`, `persistOnClick`, `overflow` (only when the text of the element is cut
   * off, with that text by default), and `uri` to load the content once from the payload of a
   * response, showing `content` until then.
   */
  set(element, content, config = {}) {
    tooltips.set(element, { ...config, content });
    listen();

    if (shown === element) {
      Tooltip.show(element);
    }
    return element;
  },

  remove(element) {
    if (active === element) {
      Tooltip.hide();
    }
    tooltips.delete(element);
  },

  has(element) {
    return tooltips.has(element);
  },

  isActive(element) {
    return shown === element;
  },

  show(element) {
    const data = tooltips.get(element);
    if (!data || !element.isConnected) {
      return false;
    }

    let { content } = data;
    if (data.overflow) {
      if (element.scrollWidth <= element.offsetWidth) {
        return false;
      }
      if (content === null || content === undefined || content === '') {
        content = element.textContent.trim();
      }
    }
    if (content === null || content === undefined || content === '') {
      return false;
    }

    clearDelay();
    if (shown && shown !== element) {
      Tooltip.hide();
    }

    active = element;
    const tooltip = getLayer();
    const root = tooltip.getRoot();
    setContent(root, content);
    root.className = [options.className, data.className].filter(Boolean).join(' ');

    const position = OPPOSITE[data.position] ? data.position : 'above';
    const vertical = position === 'above' || position === 'below';
    tooltip
      .setContext(element)
      .setPosition(position)
      .setAlignment(data.alignment || 'center')
      .setOffset(vertical ? 0 : GAP, vertical ? GAP : 0);

    tooltip.show();
    if (!tooltip.isShown()) {
      return false;
    }

    shown = element;
    describe(element);
    return true;
  },

  hide() {
    clearDelay();
    active = null;
    if (layer && layer.isShown()) {
      layer.hide();
    }
    release();
  },

  /**
   * Changes the look of all tooltips: `className` replaces the default inline style, `zIndex`,
   * and the default `delay`.
   */
  configure(config) {
    options = { ...config };
    if (layer) {
      Tooltip.hide();
      applyLook();
    }
  },

  getLayer() {
    return getLayer();
  }
};

export default Tooltip;
