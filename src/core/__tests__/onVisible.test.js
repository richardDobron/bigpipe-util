import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import onVisible from '../onVisible';

let observers;

class FakeIntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.elements = [];
    this.disconnected = false;
    observers.push(this);
  }

  observe(element) {
    this.elements.push(element);
  }

  disconnect() {
    this.disconnected = true;
  }

  trigger(isIntersecting) {
    this.callback(this.elements.map(target => ({ target, isIntersecting })));
  }
}

let element;

beforeEach(() => {
  observers = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  element = document.createElement('div');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('onVisible', () => {
  it('calls the callback once the element is visible, then stops observing', () => {
    const callback = vi.fn();

    onVisible(element, callback);
    const [observer] = observers;
    expect(observer.elements).toEqual([element]);

    observer.trigger(false);
    expect(callback).not.toHaveBeenCalled();

    observer.trigger(true);
    expect(callback).toHaveBeenCalledWith(element);
    expect(observer.disconnected).toBe(true);
  });

  it('extends the viewport by the buffer', () => {
    onVisible(element, vi.fn(), { buffer: 300 });

    expect(observers[0].options).toEqual({ rootMargin: '300px' });
  });

  it('stops waiting when removed', () => {
    const callback = vi.fn();

    onVisible(element, callback).remove();

    expect(observers[0].disconnected).toBe(true);
  });

  it('calls the callback right away without IntersectionObserver', () => {
    vi.useFakeTimers();
    vi.stubGlobal('IntersectionObserver', undefined);
    const callback = vi.fn();

    onVisible(element, callback);
    expect(callback).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(callback).toHaveBeenCalledWith(element);
  });
});
