import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AutoFocus from '../AutoFocus';
import Layer from '../Layer';
import RefocusOnHide from '../RefocusOnHide';
import RemoveOnHide from '../RemoveOnHide';
import TabIsolation from '../TabIsolation';

let layers;

beforeEach(() => {
  vi.useFakeTimers();
  layers = [];
  document.body.innerHTML = '<button id="opener">Open</button>';
});

afterEach(() => {
  layers.forEach(layer => layer.destroy());
  vi.useRealTimers();
});

function create(html, behaviors, config = {}) {
  const layer = new Layer(html, { behaviors, ...config });
  layers.push(layer);
  return layer;
}

function tab(shiftKey = false) {
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true
  });
  document.activeElement.dispatchEvent(event);
  return event;
}

describe('AutoFocus', () => {
  it('focuses the element with autofocus', () => {
    const layer = create('<div><button id="a">A</button><input id="b" autofocus></div>', [AutoFocus]);

    layer.show();

    expect(document.activeElement.id).toBe('b');
  });

  it('focuses the first control, not a link', () => {
    const layer = create('<div><a href="/x">Link</a><button id="a">A</button></div>', [AutoFocus]);

    layer.show();

    expect(document.activeElement.id).toBe('a');
  });

  it('focuses the root when there is nothing to focus', () => {
    const layer = create('<div>Text</div>', [AutoFocus]);

    layer.show();

    expect(document.activeElement).toBe(layer.getRoot());
  });

  it('keeps the focus of a control that already has it', () => {
    const layer = create('<div><input id="a"><input id="b"></div>', [AutoFocus]);
    layer.show();
    document.getElementById('b').focus();

    layer.inform('aftershow');

    expect(document.activeElement.id).toBe('b');
  });
});

describe('TabIsolation', () => {
  const html = '<div><button id="a">A</button><button id="b">B</button></div>';

  it('keeps Tab inside of the topmost layer', () => {
    const layer = create(html, [TabIsolation]);
    layer.show();
    vi.runAllTimers();

    document.getElementById('b').focus();
    const forward = tab();
    expect(document.activeElement.id).toBe('a');
    expect(forward.defaultPrevented).toBe(true);

    const backward = tab(true);
    expect(document.activeElement.id).toBe('b');
    expect(backward.defaultPrevented).toBe(true);
  });

  it('leaves Tab between the controls inside alone', () => {
    const layer = create(html, [TabIsolation]);
    layer.show();
    vi.runAllTimers();

    document.getElementById('a').focus();

    expect(tab().defaultPrevented).toBe(false);
  });

  it('brings the focus in when it is outside', () => {
    const layer = create(html, [TabIsolation]);
    layer.show();
    vi.runAllTimers();

    document.getElementById('opener').focus();
    tab();

    expect(document.activeElement.id).toBe('a');
  });

  it('does not trap layers below the topmost', () => {
    const lower = create('<div><button id="low">Low</button></div>', [TabIsolation]);
    const upper = create(html, [TabIsolation]);
    lower.show();
    upper.show();
    vi.runAllTimers();

    document.getElementById('a').focus();
    tab();

    expect(document.activeElement.id).toBe('a');
  });
});

describe('RefocusOnHide', () => {
  it('gives the focus back to the element that had it', () => {
    const opener = document.getElementById('opener');
    const layer = create('<div><button id="a">A</button></div>', [AutoFocus, RefocusOnHide]);
    opener.focus();

    layer.show();
    expect(document.activeElement.id).toBe('a');

    layer.hide();
    expect(document.activeElement).toBe(opener);
  });

  it('prefers the causal element', () => {
    document.body.innerHTML += '<button id="trigger">Trigger</button>';
    const trigger = document.getElementById('trigger');
    const layer = create('<div><button id="a">A</button></div>', [AutoFocus, RefocusOnHide, RemoveOnHide], {
      causalElement: trigger
    });
    document.getElementById('opener').focus();

    layer.show();
    layer.hide();

    expect(document.activeElement).toBe(trigger);
  });

  it('does not take the focus from somewhere else', () => {
    document.body.innerHTML += '<input id="other">';
    const layer = create('<div><button id="a">A</button></div>', [RefocusOnHide]);
    document.getElementById('opener').focus();
    layer.show();

    document.getElementById('other').focus();
    layer.hide();

    expect(document.activeElement.id).toBe('other');
  });
});
