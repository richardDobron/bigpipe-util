import { afterEach, describe, expect, it, vi } from 'vitest';
import onAfterLoad from '../onAfterLoad';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('onAfterLoad', () => {
  it('runs the callback once, after the window load event', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const callback = vi.fn();

    onAfterLoad(callback);
    expect(callback).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('load'));
    window.dispatchEvent(new Event('load'));
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith();
  });

  it('runs the callback asynchronously when the page is already loaded', () => {
    vi.useFakeTimers();
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
    const callback = vi.fn();

    onAfterLoad(callback);
    expect(callback).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(callback).toHaveBeenCalledOnce();
  });
});
