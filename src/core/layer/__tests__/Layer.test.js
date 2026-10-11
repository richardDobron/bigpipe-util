import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Layer from '../Layer';

let layer;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<button id="opener">Open</button>';
});

afterEach(() => {
  if (layer) {
    layer.destroy();
    layer = null;
  }
  vi.useRealTimers();
});

function click(target) {
  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('Layer', () => {
  it('builds its root from HTML and adds classes and attributes without assuming a CSS framework', () => {
    layer = new Layer('<div class="menu">Menu</div>', {
      classNames: ['shadow-lg', 'rounded'],
      attributes: { role: 'menu' }
    });

    const root = layer.getRoot();
    expect(root.className).toBe('menu shadow-lg rounded');
    expect(root.getAttribute('role')).toBe('menu');
    expect(root.isConnected).toBe(false);
    expect(Layer.getLayerOf(root)).toBe(layer);
  });

  it('shows the root in the body and hides it again', () => {
    layer = new Layer('<div>Menu</div>');
    const events = [];
    ['beforeshow', 'show', 'aftershow', 'beforehide', 'starthide', 'hide'].forEach(name =>
      layer.subscribe(name, () => events.push(name))
    );

    layer.show();
    expect(layer.isShown()).toBe(true);
    expect(layer.getRoot().parentNode).toBe(document.body);
    expect(layer.getRoot().style.display).not.toBe('none');

    layer.hide();
    expect(layer.isShown()).toBe(false);
    expect(layer.getRoot().style.display).toBe('none');
    expect(events).toEqual(['beforeshow', 'show', 'aftershow', 'beforehide', 'starthide', 'hide']);
  });

  it('can be inserted in another element', () => {
    document.body.innerHTML += '<div id="host"></div>';
    layer = new Layer('<div>Menu</div>', { insertParent: document.getElementById('host') });

    layer.show();

    expect(layer.getRoot().parentNode.id).toBe('host');
  });

  it('can be kept open by beforehide and finished later by starthide', () => {
    layer = new Layer('<div>Menu</div>');
    layer.show();

    const keep = layer.subscribe('beforehide', () => false);
    layer.hide();
    expect(layer.isShown()).toBe(true);
    keep.remove();

    layer.subscribe('starthide', () => false);
    layer.hide();
    expect(layer.isShown()).toBe(true);

    layer.finishHide();
    expect(layer.isShown()).toBe(false);
  });

  it('does not show when the position can not be calculated', () => {
    layer = new Layer('<div>Menu</div>');
    layer.updatePosition = () => false;

    layer.show();

    expect(layer.isShown()).toBe(false);
  });

  it('informs the layers of the class and removes subscriptions', () => {
    layer = new Layer('<div>Menu</div>');
    const shown = vi.fn();
    const subscription = Layer.subscribe('show', shown);

    layer.show();
    expect(shown).toHaveBeenCalledWith(layer, 'show');

    subscription.remove();
    layer.hide();
    layer.show();
    expect(shown).toHaveBeenCalledOnce();
  });

  it('enables behaviors once and disables them when destroyed', () => {
    const enable = vi.fn();
    const disable = vi.fn();
    class Behavior {
      enable() {
        enable();
      }

      disable() {
        disable();
      }
    }

    layer = new Layer('<div>Menu</div>', { behaviors: [Behavior, Behavior] });
    expect(enable).toHaveBeenCalledOnce();
    expect(layer.hasBehavior(Behavior)).toBe(true);

    layer.destroy();
    expect(disable).toHaveBeenCalledOnce();
    layer = null;
  });

  it('removes its root and informs when destroyed', () => {
    layer = new Layer('<div>Menu</div>');
    const destroyed = vi.fn();
    layer.subscribe('destroy', destroyed);
    layer.show();
    const root = layer.getRoot();

    layer.destroy();

    expect(root.isConnected).toBe(false);
    expect(destroyed).toHaveBeenCalledOnce();
    expect(Layer.getLayerOf(root)).toBeUndefined();
    layer = null;
  });

  it('can not be shown again once destroyed', () => {
    layer = new Layer('<div>Menu</div>', { causalElement: document.getElementById('opener') });
    layer.show();
    const root = layer.getRoot();
    layer.destroy();

    expect(layer.getRoot()).toBeNull();
    expect(layer.getCausalElement()).toBeNull();
    expect(() => layer.show()).toThrow('the layer was destroyed');
    expect(root.isConnected).toBe(false);
    layer.destroy();
    layer = null;
  });

  it('tracks the topmost shown layer', () => {
    layer = new Layer('<div>One</div>');
    const second = new Layer('<div>Two</div>');

    layer.show();
    second.show();
    vi.runAllTimers();
    expect(Layer.getTopmostLayer()).toBe(second);

    second.destroy();
    expect(Layer.getTopmostLayer()).toBe(layer);
  });

  it('gives keys to the layers from the topmost and stops at the one that handles it', () => {
    layer = new Layer('<div>One</div>');
    const second = new Layer('<div>Two</div>');
    const first = vi.fn();
    const handled = vi.fn(() => false);
    layer.subscribe('key', first);
    second.subscribe('key', handled);
    layer.show();
    second.show();
    vi.runAllTimers();

    const page = vi.fn();
    document.addEventListener('keydown', page);

    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    document.removeEventListener('keydown', page);

    expect(handled).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
    expect(page).not.toHaveBeenCalled();
    second.destroy();
  });

  it('informs blur for a click outside, not for a click inside or on the opener of the same click', () => {
    layer = new Layer('<div><span id="inside">Menu</span></div>');
    const blur = vi.fn();
    layer.subscribe('blur', blur);

    const opener = document.getElementById('opener');
    opener.addEventListener('click', () => layer.show());
    click(opener);
    vi.runAllTimers();
    expect(blur).not.toHaveBeenCalled();

    click(document.getElementById('inside'));
    expect(blur).not.toHaveBeenCalled();

    click(opener);
    expect(blur).toHaveBeenCalledOnce();
    expect(blur.mock.calls[0][0].target).toBe(opener);
  });

  it('does not inform blur when the press and release were on different elements', () => {
    layer = new Layer('<div>Menu</div>');
    const blur = vi.fn();
    layer.subscribe('blur', blur);
    layer.show();
    vi.runAllTimers();

    const opener = document.getElementById('opener');
    opener.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    opener.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(blur).not.toHaveBeenCalled();
  });

  it('treats a layer opened from inside a layer as part of it', () => {
    layer = new Layer('<div><button id="more">More</button></div>');
    const nested = new Layer('<div id="submenu">Sub</div>', {
      causalElement: null
    });
    const blur = vi.fn();
    layer.subscribe('blur', blur);
    layer.show();
    nested.setCausalElement(document.getElementById('more'));
    nested.show();
    vi.runAllTimers();

    click(document.getElementById('submenu'));

    expect(blur).not.toHaveBeenCalled();
    nested.destroy();
  });
});
