import { afterEach, describe, expect, it, vi } from 'vitest';
import Arbiter from '../src/core/Arbiter';

afterEach(() => {
  new Arbiter().clearSubscribers('ORDER/READY');
  vi.useRealTimers();
});

describe('Arbiter', () => {
  it('shares the subscribers between instances', () => {
    const callback = vi.fn();

    new Arbiter().subscribe('ORDER/READY', callback);
    new Arbiter().inform('ORDER/READY', { id: 1 }, 'extra');

    expect(callback).toHaveBeenCalledWith({ id: 1 }, 'extra');
  });

  it('unsubscribes callbacks', () => {
    const callback = vi.fn();
    const arbiter = new Arbiter().subscribe('ORDER/READY', callback);

    arbiter.unsubscribe('ORDER/READY', callback).inform('ORDER/READY');

    expect(callback).not.toHaveBeenCalled();
  });

  it('calls the other subscribers when one throws', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    new Arbiter()
      .subscribe('ORDER/READY', () => {
        throw new Error('subscriber failed');
      })
      .subscribe('ORDER/READY', callback)
      .inform('ORDER/READY');

    expect(callback).toHaveBeenCalledOnce();
    expect(() => vi.runAllTimers()).toThrow('subscriber failed');
  });
});
