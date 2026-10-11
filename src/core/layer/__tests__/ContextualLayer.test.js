import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ContextualLayer from '../ContextualLayer';

let layer;
let button;

function rect(left, top, width, height) {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

beforeEach(() => {
  document.body.innerHTML = '<button id="button">Menu</button>';
  button = document.getElementById('button');
  button.getBoundingClientRect = () => rect(100, 200, 80, 30);
  Object.defineProperty(document.documentElement, 'clientWidth', { value: 1000, configurable: true });
  Object.defineProperty(document.documentElement, 'clientHeight', { value: 600, configurable: true });
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => callback());
});

afterEach(() => {
  layer.destroy();
  vi.restoreAllMocks();
});

function create(config) {
  layer = new ContextualLayer('<div>Menu</div>', { context: button, ...config });
  Object.defineProperty(layer.getRoot(), 'offsetWidth', { value: 120 });
  Object.defineProperty(layer.getRoot(), 'offsetHeight', { value: 50 });
  return layer;
}

function placed() {
  const { style } = layer.getRoot();
  return [style.left, style.top];
}

describe('ContextualLayer', () => {
  it('shows below the context, aligned to its start', () => {
    create().show();

    expect(placed()).toEqual(['100px', '230px']);
    expect(layer.getRoot().style.position).toBe('absolute');
    expect(layer.getPosition()).toBe('below');
  });

  it.each([
    ['center', '80px'],
    ['end', '60px']
  ])('aligns to the %s of the context', (alignment, left) => {
    create({ alignment }).show();

    expect(placed()).toEqual([left, '230px']);
  });

  it.each([
    ['above', ['100px', '150px']],
    ['right', ['180px', '200px']],
    ['left', ['-20px', '200px']]
  ])('shows %s the context', (position, expected) => {
    create({ position, autoFlip: false, keepInViewport: false }).show();

    expect(placed()).toEqual(expected);
  });

  it('adds the offsets', () => {
    create({ offsetX: 5, offsetY: 8 }).show();

    expect(placed()).toEqual(['105px', '238px']);
  });

  it('flips to the other side when it does not fit', () => {
    button.getBoundingClientRect = () => rect(100, 560, 80, 30);
    create().show();

    expect(layer.getPosition()).toBe('above');
    expect(placed()).toEqual(['100px', '510px']);
  });

  it('does not flip when the other side does not fit either', () => {
    button.getBoundingClientRect = () => rect(100, 20, 80, 580);
    create().show();

    expect(layer.getPosition()).toBe('below');
  });

  it('does not flip without autoFlip', () => {
    button.getBoundingClientRect = () => rect(100, 560, 80, 30);
    create({ autoFlip: false }).show();

    expect(layer.getPosition()).toBe('below');
  });

  it('keeps itself inside of the viewport', () => {
    button.getBoundingClientRect = () => rect(950, 200, 40, 30);
    create().show();

    expect(placed()[0]).toBe('880px');
  });

  it('accepts a function as the context and follows changes', () => {
    create({ context: () => button }).show();
    button.getBoundingClientRect = () => rect(300, 200, 80, 30);

    layer.setPosition('below');

    expect(placed()).toEqual(['300px', '230px']);
  });

  it('does not show without a context on the page', () => {
    create({ context: null }).show();

    expect(layer.isShown()).toBe(false);
  });

  it('does not show while its context is not displayed', () => {
    button.style.display = 'none';
    create().show();
    expect(layer.isShown()).toBe(false);
    layer.destroy();

    button.style.display = '';
    document.body.innerHTML = '<div style="display: none"></div>';
    document.body.firstChild.appendChild(button);
    create().show();
    expect(layer.isShown()).toBe(false);
  });

  it.each([
    ['positioned', 'position: relative'],
    ['transformed', 'transform: translateX(10px)']
  ])('is placed relative to a %s insert parent', (_, style) => {
    document.body.insertAdjacentHTML('beforeend', `<div id="host" style="${style}"></div>`);
    const host = document.getElementById('host');
    host.getBoundingClientRect = () => rect(40, 100, 500, 400);
    Object.defineProperty(host, 'scrollTop', { value: 20 });
    window.scrollY = 300;

    create({ insertParent: host }).show();
    window.scrollY = 0;

    expect(layer.getRoot().parentNode).toBe(host);
    expect(placed()).toEqual(['60px', '150px']);
  });

  it('is placed in the page in an insert parent that is not positioned', () => {
    document.body.insertAdjacentHTML('beforeend', '<div id="host"></div>');
    window.scrollY = 300;

    create({ insertParent: document.getElementById('host') }).show();
    window.scrollY = 0;

    expect(placed()).toEqual(['100px', '530px']);
  });

  it('updates its position on resize while it is shown, not after it is hidden', () => {
    create().show();
    button.getBoundingClientRect = () => rect(400, 200, 80, 30);

    window.dispatchEvent(new Event('resize'));
    expect(placed()[0]).toBe('400px');

    layer.hide();
    button.getBoundingClientRect = () => rect(500, 200, 80, 30);
    window.dispatchEvent(new Event('resize'));
    expect(placed()[0]).toBe('400px');
  });

  it('is above the modal or dialog its context is in', () => {
    document.body.innerHTML = '<div id="modal" style="position: fixed; z-index: 1050"></div>';
    document.getElementById('modal').appendChild(button);
    create().show();

    expect(layer.getRoot().style.zIndex).toBe('1051');
  });

  it('sets no z-index for a context outside of a modal', () => {
    create().show();

    expect(layer.getRoot().style.zIndex).toBe('');
  });

  it('informs reposition', () => {
    const repositioned = vi.fn();
    create();
    layer.subscribe('reposition', repositioned);

    layer.show();

    expect(repositioned).toHaveBeenCalledWith({ position: 'below', alignment: 'start' }, 'reposition');
  });
});
