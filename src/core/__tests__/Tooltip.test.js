import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Tooltip from '../Tooltip';
import Arbiter from '../Arbiter';
import { asyncResponse, installFakeXHR } from '../../__testutils__/fakeXHR';

let button;
let other;

beforeEach(() => {
  document.body.innerHTML =
    '<button id="button" aria-describedby="hint"><span id="label">Save</span></button><a id="other" href="#">Other</a>';
  button = document.getElementById('button');
  other = document.getElementById('other');
  button.getBoundingClientRect = () => ({
    left: 100,
    top: 200,
    width: 80,
    height: 30,
    right: 180,
    bottom: 230
  });
  Object.defineProperty(document.documentElement, 'clientWidth', {
    value: 1000,
    configurable: true
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    value: 600,
    configurable: true
  });
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => callback());
});

afterEach(() => {
  Tooltip.hide();
  Tooltip.configure({});
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function hover(element) {
  element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
}

function root() {
  return Tooltip.getLayer().getRoot();
}

describe('Tooltip', () => {
  it('shows above the element while the pointer is over it', () => {
    Tooltip.set(button, 'Saves the draft\nfor later');

    hover(document.getElementById('label'));

    expect(Tooltip.isActive(button)).toBe(true);
    expect(root().textContent).toBe('Saves the draft\nfor later');
    expect(root().getAttribute('role')).toBe('tooltip');
    expect(root().style.display).not.toBe('none');
    expect(Tooltip.getLayer().getPosition()).toBe('above');
    expect(button.getAttribute('aria-describedby')).toBe(`hint ${root().id}`);

    hover(other);

    expect(Tooltip.isActive(button)).toBe(false);
    expect(root().style.display).toBe('none');
    expect(button.getAttribute('aria-describedby')).toBe('hint');
  });

  it('shows while the element has the focus', () => {
    Tooltip.set(other, 'Opens the other page', { position: 'right' });

    other.focus();
    expect(Tooltip.isActive(other)).toBe(true);
    expect(Tooltip.getLayer().getPosition()).toBe('right');

    other.blur();
    expect(Tooltip.isActive(other)).toBe(false);
  });

  it('hides on a click, unless it persists on click', () => {
    Tooltip.set(button, 'Save');
    hover(button);
    button.click();
    expect(Tooltip.isActive(button)).toBe(false);

    Tooltip.set(other, 'Other', { persistOnClick: true });
    hover(other);
    other.click();
    expect(Tooltip.isActive(other)).toBe(true);
  });

  it('hides on Escape', () => {
    vi.useFakeTimers();
    Tooltip.set(button, 'Save');
    hover(button);
    button.focus();
    vi.runAllTimers();
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(Tooltip.isActive(button)).toBe(false);
  });

  it('waits for the delay, and not when the pointer left before', () => {
    vi.useFakeTimers();
    Tooltip.set(button, 'Save', { delay: 500 });

    hover(button);
    vi.advanceTimersByTime(499);
    expect(Tooltip.isActive(button)).toBe(false);
    vi.advanceTimersByTime(1);
    expect(Tooltip.isActive(button)).toBe(true);

    hover(other);
    hover(button);
    hover(other);
    vi.advanceTimersByTime(500);
    expect(Tooltip.isActive(button)).toBe(false);
  });

  it('shows a DOM node or HTML', () => {
    const strong = document.createElement('strong');
    strong.textContent = 'Bold';
    Tooltip.set(button, strong);
    hover(button);
    expect(root().firstChild).toBe(strong);

    Tooltip.set(other, { __html: '<em>Italic</em>' });
    hover(other);
    expect(root().innerHTML).toBe('<em>Italic</em>');
  });

  it('updates the content while it is shown', () => {
    Tooltip.set(button, 'Save');
    hover(button);

    Tooltip.set(button, 'Saved');

    expect(root().textContent).toBe('Saved');
  });

  it('loads the content once from the payload of a response', () => {
    const requests = installFakeXHR();
    Tooltip.set(button, 'Loading…', { uri: '/ajax/tooltip?id=1' });

    hover(button);
    expect(root().textContent).toBe('Loading…');
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('GET');

    requests[0].respond(200, asyncResponse({ payload: { __html: '<b>Marvin</b>' } }));
    expect(root().innerHTML).toBe('<b>Marvin</b>');

    hover(other);
    hover(button);
    expect(requests).toHaveLength(1);
    expect(root().innerHTML).toBe('<b>Marvin</b>');
  });

  it('shows the text of an element that is cut off only', () => {
    const label = document.getElementById('label');
    Object.defineProperty(label, 'offsetWidth', { configurable: true, value: 100 });
    Object.defineProperty(label, 'scrollWidth', { configurable: true, value: 100 });
    Tooltip.set(label, null, { overflow: true });

    hover(label);
    expect(Tooltip.isActive(label)).toBe(false);

    hover(other);
    Object.defineProperty(label, 'scrollWidth', { configurable: true, value: 180 });
    hover(label);
    expect(Tooltip.isActive(label)).toBe(true);
    expect(root().textContent).toBe('Save');
  });

  it('is not shown for an element without content or after remove()', () => {
    Tooltip.set(button, '');
    hover(button);
    expect(Tooltip.isActive(button)).toBe(false);

    Tooltip.set(other, 'Other');
    hover(other);
    Tooltip.remove(other);
    expect(Tooltip.isActive(other)).toBe(false);
    expect(Tooltip.has(other)).toBe(false);
  });

  it('has a default look that a class name replaces', () => {
    Tooltip.set(button, 'Save', { className: 'wide' });
    hover(button);
    expect(root().style.backgroundColor).not.toBe('');
    expect(root().className).toBe('wide');

    Tooltip.configure({ className: 'tooltip', zIndex: 60 });
    hover(button);
    expect(root().style.backgroundColor).toBe('');
    expect(root().className).toBe('tooltip wide');
    expect(root().style.zIndex).toBe('60');
  });

  it('hides before a page transition', () => {
    Tooltip.set(button, 'Save');
    hover(button);

    new Arbiter().inform('PageTransitions/beforeTransition', { from: '/a', to: '/b' });

    expect(Tooltip.isActive(button)).toBe(false);
  });

  it('can be set by the server', async () => {
    const { default: ServerJS } = await import('../../ServerJS');
    await import('../../ModuleRegistry');

    new ServerJS().handle({
      require: [
        [
          'bigpipe-util/dist/core/Tooltip',
          'set',
          [{ __e: 'button' }, 'From the server', { position: 'below' }]
        ]
      ]
    });
    hover(button);

    expect(root().textContent).toBe('From the server');
    expect(Tooltip.getLayer().getPosition()).toBe('below');
  });
});
