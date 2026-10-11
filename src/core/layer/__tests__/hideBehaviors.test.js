import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Arbiter from '../../Arbiter';
import DestroyOnHide from '../DestroyOnHide';
import HideOnBlur from '../HideOnBlur';
import HideOnEscape from '../HideOnEscape';
import HideOnTransition from '../HideOnTransition';
import HideSources from '../HideSources';
import Layer from '../Layer';
import RemoveOnHide from '../RemoveOnHide';

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

function create(behaviors) {
  const layer = new Layer('<div><span id="inside">Menu</span></div>', { behaviors });
  layers.push(layer);
  return layer;
}

function press(key, target = document.body) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

describe('HideOnEscape', () => {
  it('leaves Escape to a text field that is not empty', () => {
    const layer = create([HideOnEscape]);
    layer.getRoot().innerHTML = '<input id="search" value="query">';
    layer.show();
    vi.runAllTimers();
    const search = document.getElementById('search');

    expect(press('Escape', search).defaultPrevented).toBe(false);
    expect(layer.isShown()).toBe(true);

    search.value = '';
    expect(press('Escape', search).defaultPrevented).toBe(true);
    expect(layer.isShown()).toBe(false);
  });

  it('hides the topmost layer on Escape and handles the key', () => {
    const lower = create([HideOnEscape]);
    const upper = create([HideOnEscape]);
    const sources = [];
    upper.subscribe('beforehide', source => sources.push(source));
    lower.show();
    upper.show();
    vi.runAllTimers();

    const event = press('Escape');

    expect(upper.isShown()).toBe(false);
    expect(lower.isShown()).toBe(true);
    expect(sources).toEqual([HideSources.ESCAPE]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('ignores other keys and stops after it is disabled', () => {
    const layer = create([HideOnEscape]);
    layer.show();
    vi.runAllTimers();

    press('a');
    expect(layer.isShown()).toBe(true);

    layer.disableBehaviors([HideOnEscape]);
    press('Escape');
    expect(layer.isShown()).toBe(true);
  });
});

describe('HideOnBlur', () => {
  function clickOutside() {
    const opener = document.getElementById('opener');
    ['mousedown', 'mouseup', 'click'].forEach(type =>
      opener.dispatchEvent(new MouseEvent(type, { bubbles: true }))
    );
  }

  it('hides on a click outside, but not on a click inside', () => {
    const layer = create([HideOnBlur]);
    layer.show();
    vi.runAllTimers();

    ['mousedown', 'mouseup', 'click'].forEach(type =>
      document.getElementById('inside').dispatchEvent(new MouseEvent(type, { bubbles: true }))
    );
    vi.runAllTimers();
    expect(layer.isShown()).toBe(true);

    clickOutside();
    vi.runAllTimers();
    expect(layer.isShown()).toBe(false);
  });

  it('leaves the layers below open', () => {
    const lower = create([HideOnBlur]);
    const upper = create([HideOnBlur]);
    lower.show();
    upper.show();
    vi.runAllTimers();

    clickOutside();
    vi.runAllTimers();

    expect(upper.isShown()).toBe(false);
    expect(lower.isShown()).toBe(true);
  });
});

describe('HideOnTransition', () => {
  it('hides before a page transition', () => {
    const layer = create([HideOnTransition]);
    layer.show();

    new Arbiter().inform('PageTransitions/beforeTransition', { from: '/a', to: '/b' });

    expect(layer.isShown()).toBe(false);
  });

  it('can decide which transitions are relevant', () => {
    class OnlyFeed extends HideOnTransition {
      isTransitionRelevant({ to }) {
        return to === '/feed';
      }
    }
    const layer = create([OnlyFeed]);
    layer.show();

    new Arbiter().inform('PageTransitions/beforeTransition', { to: '/other' });
    expect(layer.isShown()).toBe(true);

    new Arbiter().inform('PageTransitions/beforeTransition', { to: '/feed' });
    expect(layer.isShown()).toBe(false);
  });

  it('stops listening when disabled', () => {
    const layer = create([HideOnTransition]);
    layer.show();
    layer.disableBehaviors([HideOnTransition]);

    new Arbiter().inform('PageTransitions/beforeTransition', {});

    expect(layer.isShown()).toBe(true);
  });
});

describe('DestroyOnHide and RemoveOnHide', () => {
  it('destroys the layer after it is hidden', () => {
    const layer = create([DestroyOnHide]);
    const destroyed = vi.fn();
    layer.subscribe('destroy', destroyed);
    layer.show();
    const root = layer.getRoot();

    layer.hide();
    expect(destroyed).not.toHaveBeenCalled();
    vi.runAllTimers();

    expect(destroyed).toHaveBeenCalledOnce();
    expect(root.isConnected).toBe(false);
    expect(layer.getRoot()).toBeNull();
  });

  it('removes the root from the page when hidden, and shows it again', () => {
    const layer = create([RemoveOnHide]);
    layer.show();

    layer.hide();
    expect(layer.getRoot().isConnected).toBe(false);

    layer.show();
    expect(layer.getRoot().isConnected).toBe(true);
  });
});
