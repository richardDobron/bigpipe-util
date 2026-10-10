import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FadeOnHide from '../FadeOnHide';
import FadeOnShow from '../FadeOnShow';
import Layer from '../Layer';

let layer;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => callback());
  document.body.innerHTML = '';
});

afterEach(() => {
  delete window.matchMedia;
  layer.destroy();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('FadeOnShow', () => {
  it('fades the root in with an inline transition and cleans up', () => {
    layer = new Layer('<div>Menu</div>', { behaviors: [FadeOnShow.forDuration(200)] });
    const { style } = layer.getRoot();

    let opacityBeforeShow;
    layer.subscribe('beforeshow', () => {
      opacityBeforeShow = style.opacity;
    });
    layer.show();

    expect(opacityBeforeShow).toBe('0');

    expect(style.transition).toBe('opacity 200ms');
    expect(style.opacity).toBe('1');

    vi.advanceTimersByTime(200);
    expect(style.transition).toBe('');
    expect(style.opacity).toBe('');
  });

  it('does not animate for users who prefer reduced motion', () => {
    window.matchMedia = vi.fn(() => ({ matches: true }));
    layer = new Layer('<div>Menu</div>', { behaviors: [FadeOnShow] });

    layer.show();

    expect(layer.getRoot().style.transition).toBe('');
    expect(layer.getRoot().style.opacity).toBe('');
  });
});

describe('FadeOnHide', () => {
  it('finishes hiding when the fade is over', () => {
    layer = new Layer('<div>Menu</div>', { behaviors: [FadeOnHide.forDuration(150)] });
    const hidden = vi.fn();
    layer.subscribe('hide', hidden);
    layer.show();

    layer.hide();
    expect(layer.getRoot().style.opacity).toBe('0');
    expect(layer.getRoot().style.transition).toBe('opacity 150ms');
    expect(hidden).not.toHaveBeenCalled();
    expect(layer.isShown()).toBe(true);

    vi.advanceTimersByTime(150);
    expect(hidden).toHaveBeenCalledOnce();
    expect(layer.isShown()).toBe(false);
    expect(layer.getRoot().style.opacity).toBe('');
  });

  it('hides right away for users who prefer reduced motion', () => {
    window.matchMedia = vi.fn(() => ({ matches: true }));
    layer = new Layer('<div>Menu</div>', { behaviors: [FadeOnHide] });
    layer.show();

    layer.hide();

    expect(layer.isShown()).toBe(false);
  });
});
