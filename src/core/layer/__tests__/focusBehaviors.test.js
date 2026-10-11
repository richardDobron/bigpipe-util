import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AutoFocus from '../AutoFocus';
import { getTabbable } from '../focusWithinLayer';
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
    const layer = create('<div><button id="a">A</button><input id="b" autofocus></div>', [
      AutoFocus
    ]);

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

describe('getTabbable', () => {
  it('skips disabled, hidden and invisible elements', () => {
    document.body.innerHTML = `<div id="root">
      <button id="a">A</button>
      <button disabled>Disabled</button>
      <input type="hidden">
      <button tabindex="-1">Not tabbable</button>
      <button hidden>Hidden</button>
      <button style="display: none">None</button>
      <div style="display: none"><input></div>
      <div style="visibility: hidden">
        <a href="/x">Invisible</a>
        <button id="b" style="visibility: visible">B</button>
      </div>
      <div hidden><textarea></textarea></div>
      <span id="c" tabindex="0">C</span>
    </div>`;

    const ids = getTabbable(document.getElementById('root')).map(element => element.id);

    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('skips the elements of a root that is not displayed', () => {
    document.body.innerHTML =
      '<div style="display: none"><div id="root"><button>A</button></div></div>';

    expect(getTabbable(document.getElementById('root'))).toEqual([]);
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

  it('keeps Tab inside from a text field that is not empty', () => {
    const layer = create('<div><button id="a">A</button><input id="b" value="text"></div>', [
      TabIsolation
    ]);
    layer.show();
    vi.runAllTimers();

    document.getElementById('b').focus();
    expect(tab().defaultPrevented).toBe(true);
    expect(document.activeElement.id).toBe('a');
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

  it('keeps Tab in the topmost trapping layer only', () => {
    const lower = create('<div><button id="low">Low</button></div>', [TabIsolation]);
    const upper = create(html, [TabIsolation]);
    lower.show();
    upper.show();
    vi.runAllTimers();

    document.getElementById('b').focus();
    tab();
    expect(document.activeElement.id).toBe('a');

    document.getElementById('low').focus();
    tab();
    expect(document.activeElement.id).toBe('a');

    upper.hide();
    document.getElementById('low').focus();
    expect(tab().defaultPrevented).toBe(true);
    expect(document.activeElement.id).toBe('low');
  });

  it('keeps Tab in a trapping layer under a layer that does not trap', () => {
    const dialog = create(html, [TabIsolation]);
    const tooltip = create('<div><button id="tip">Tip</button></div>', []);
    dialog.show();
    tooltip.show();
    vi.runAllTimers();

    document.getElementById('b').focus();
    expect(tab().defaultPrevented).toBe(true);
    expect(document.activeElement.id).toBe('a');

    document.getElementById('opener').focus();
    tab();
    expect(document.activeElement.id).toBe('a');

    document.getElementById('tip').focus();
    tab();
    expect(document.activeElement.id).toBe('a');
  });

  it('moves Tab through the layers opened from inside of it and back', () => {
    const dialog = create(html, [TabIsolation]);
    const menu = create('<div><button id="m1">1</button><button id="m2">2</button></div>', []);
    const submenu = create('<div><button id="s1">1</button></div>', []);
    dialog.show();
    menu.setCausalElement(document.getElementById('b')).show();
    submenu.setCausalElement(document.getElementById('m2')).show();
    vi.runAllTimers();

    document.getElementById('m1').focus();
    expect(tab().defaultPrevented).toBe(false);

    document.getElementById('m2').focus();
    expect(tab().defaultPrevented).toBe(true);
    expect(document.activeElement.id).toBe('b');

    document.getElementById('m1').focus();
    tab(true);
    expect(document.activeElement.id).toBe('b');

    document.getElementById('s1').focus();
    tab();
    expect(document.activeElement.id).toBe('m2');

    menu.getRoot().setAttribute('tabindex', '-1');
    menu.getRoot().focus();
    tab();
    expect(document.activeElement.id).toBe('m1');
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
    const layer = create(
      '<div><button id="a">A</button></div>',
      [AutoFocus, RefocusOnHide, RemoveOnHide],
      {
        causalElement: trigger
      }
    );
    document.getElementById('opener').focus();

    layer.show();
    layer.hide();

    expect(document.activeElement).toBe(trigger);
  });

  it('falls back to a visible ancestor of a causal element that is hidden by now', () => {
    document.body.innerHTML += '<div id="toolbar"><button id="trigger">Trigger</button></div>';
    const trigger = document.getElementById('trigger');
    const layer = create('<div><button id="a">A</button></div>', [AutoFocus, RefocusOnHide], {
      causalElement: trigger
    });

    layer.show();
    trigger.style.display = 'none';
    layer.hide();

    const toolbar = document.getElementById('toolbar');
    expect(document.activeElement).toBe(toolbar);
    expect(toolbar.getAttribute('tabindex')).toBe('-1');
  });

  it('falls back to the opener of the hidden layer the causal element is in', () => {
    const opener = document.getElementById('opener');
    const menu = create('<div><button id="more">More</button></div>', [], {
      causalElement: opener
    });
    const submenu = create('<div><button id="a">A</button></div>', [AutoFocus, RefocusOnHide], {
      causalElement: null
    });
    menu.show();
    submenu.setCausalElement(document.getElementById('more')).show();

    menu.hide();
    submenu.hide();

    expect(document.activeElement).toBe(opener);
  });

  it('gives up when the causal element is not on the page anymore', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    const layer = create(
      '<div><button id="a">A</button></div>',
      [RemoveOnHide, AutoFocus, RefocusOnHide],
      { causalElement: trigger }
    );

    layer.show();
    trigger.remove();
    layer.hide();

    expect(document.activeElement).toBe(document.body);
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
