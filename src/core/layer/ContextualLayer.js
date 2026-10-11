import Layer from './Layer';

const OPPOSITE = { above: 'below', below: 'above', left: 'right', right: 'left' };

function place(position, alignment, rect, width, height, offsetX, offsetY) {
  const vertical = position === 'above' || position === 'below';
  let top;
  let left;

  if (vertical) {
    top = position === 'below' ? rect.bottom + offsetY : rect.top - height - offsetY;
    left = rect.left;
    if (alignment === 'center') {
      left = rect.left + (rect.width - width) / 2;
    } else if (alignment === 'end') {
      left = rect.right - width;
    }
    left += offsetX;
  } else {
    left = position === 'right' ? rect.right + offsetX : rect.left - width - offsetX;
    top = rect.top;
    if (alignment === 'center') {
      top = rect.top + (rect.height - height) / 2;
    } else if (alignment === 'end') {
      top = rect.bottom - height;
    }
    top += offsetY;
  }

  return { top, left };
}

// An element with display: none, or inside of one, has no offsetParent. Neither has a fixed one, and
// jsdom has no layout, so the styles decide then.
function isRendered(element) {
  if (element.offsetParent) {
    return true;
  }

  for (let node = element; node; node = node.parentElement) {
    if (window.getComputedStyle(node).display === 'none') {
      return false;
    }
  }

  return true;
}

// Where the absolute position of the root starts, in the viewport: the padding box of its containing
// block when it is inserted in a positioned or transformed element, else the page.
function getOrigin(root, insertParent) {
  const { body, documentElement } = document;
  let node = insertParent === body ? null : root.parentElement;

  while (node && node !== body && node !== documentElement) {
    const style = window.getComputedStyle(node);

    if (style.position !== 'static' || (style.transform && style.transform !== 'none')) {
      const rect = node.getBoundingClientRect();
      return {
        top: rect.top + node.clientTop - node.scrollTop,
        left: rect.left + node.clientLeft - node.scrollLeft
      };
    }

    node = node.parentElement;
  }

  return { top: -window.scrollY, left: -window.scrollX };
}

// The z-index of the outermost positioned ancestor of the element below `relative` that has one,
// e.g. of the modal or dialog the element is in, or null.
function getOverlayZIndex(element, relative) {
  const ancestors = [];
  let node = element;
  for (; node && node !== relative; node = node.parentElement) {
    ancestors.unshift(node);
  }

  if (node !== relative) {
    return null;
  }

  for (const ancestor of ancestors) {
    const style = window.getComputedStyle(ancestor);
    const zIndex = parseInt(style.zIndex, 10);
    if (style.position !== 'static' && !Number.isNaN(zIndex)) {
      return zIndex;
    }
  }

  return null;
}

function fits(position, { top, left }, width, height, viewport) {
  if (position === 'above' || position === 'below') {
    return top >= 0 && top + height <= viewport.height;
  }
  return left >= 0 && left + width <= viewport.width;
}

export default class ContextualLayer extends Layer {
  constructor(root, config = {}) {
    super(root, config);

    this.context = config.context || null;
    this.position = config.position || 'below';
    this.alignment = config.alignment || 'start';
    this.offsetX = config.offsetX || 0;
    this.offsetY = config.offsetY || 0;
    this.autoFlip = config.autoFlip !== false;
    this.keepInViewport = config.keepInViewport !== false;
    this.actualPosition = this.position;
    this.reposition = () => window.requestAnimationFrame(() => this.updatePosition());

    this.subscribe('show', () => {
      window.addEventListener('resize', this.reposition);
      window.addEventListener('scroll', this.reposition, true);
    });
    this.subscribe('hide', () => {
      window.removeEventListener('resize', this.reposition);
      window.removeEventListener('scroll', this.reposition, true);
    });
  }

  getContext() {
    return typeof this.context === 'function' ? this.context() : this.context;
  }

  setContext(context) {
    this.context = context;
    return this.refresh();
  }

  setPosition(position) {
    this.position = position;
    return this.refresh();
  }

  setAlignment(alignment) {
    this.alignment = alignment;
    return this.refresh();
  }

  setOffset(x, y) {
    this.offsetX = x;
    this.offsetY = y;
    return this.refresh();
  }

  getPosition() {
    return this.actualPosition;
  }

  refresh() {
    if (this.shown) {
      this.updatePosition();
    }
    return this;
  }

  updatePosition() {
    const context = this.getContext();
    if (!context || !context.isConnected || !isRendered(context)) {
      return false;
    }

    const root = this.getRoot();
    const rect = context.getBoundingClientRect();
    const width = root.offsetWidth;
    const height = root.offsetHeight;
    const viewport = {
      width: document.documentElement.clientWidth || window.innerWidth,
      height: document.documentElement.clientHeight || window.innerHeight
    };
    const args = [this.alignment, rect, width, height, this.offsetX, this.offsetY];

    let position = this.position;
    let coordinates = place(position, ...args);

    if (this.autoFlip && !fits(position, coordinates, width, height, viewport)) {
      const flipped = place(OPPOSITE[position], ...args);
      if (fits(OPPOSITE[position], flipped, width, height, viewport)) {
        position = OPPOSITE[position];
        coordinates = flipped;
      }
    }

    let { top, left } = coordinates;
    if (this.keepInViewport && viewport.width > width) {
      left = Math.min(Math.max(left, 0), viewport.width - width);
    }

    const origin = getOrigin(root, this.getInsertParent());
    root.style.position = 'absolute';
    root.style.top = `${top - origin.top}px`;
    root.style.left = `${left - origin.left}px`;

    // Above the modal or dialog of the context, which it is not inside of.
    const zIndex = getOverlayZIndex(context, this.getInsertParent());
    root.style.zIndex = zIndex === null ? '' : String(zIndex + 1);

    this.actualPosition = position;
    this.inform('reposition', { position, alignment: this.alignment });

    return true;
  }
}
