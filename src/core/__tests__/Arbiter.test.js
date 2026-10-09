import { afterEach, describe, expect, it, vi } from 'vitest';
import Arbiter from '../Arbiter';

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

  it('removes a subscription', () => {
    const callback = vi.fn();
    const subscription = new Arbiter().subscribe('ORDER/READY', callback);

    subscription.remove();
    new Arbiter().inform('ORDER/READY');

    expect(callback).not.toHaveBeenCalled();
  });

  it('removes only its own subscription, also when removed twice', () => {
    const callback = vi.fn();
    const arbiter = new Arbiter();
    const first = arbiter.subscribe('ORDER/READY', callback);
    arbiter.subscribe('ORDER/READY', callback);

    first.remove();
    first.remove();
    arbiter.inform('ORDER/READY');

    expect(callback).toHaveBeenCalledOnce();
  });

  it('unsubscribes callbacks', () => {
    const callback = vi.fn();
    const arbiter = new Arbiter();
    arbiter.subscribe('ORDER/READY', callback);

    arbiter.unsubscribe('ORDER/READY', callback).inform('ORDER/READY');

    expect(callback).not.toHaveBeenCalled();
  });

  it('calls the other subscribers when one throws', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const arbiter = new Arbiter();

    arbiter.subscribe('ORDER/READY', () => {
      throw new Error('subscriber failed');
    });
    arbiter.subscribe('ORDER/READY', callback);
    arbiter.inform('ORDER/READY');

    expect(callback).toHaveBeenCalledOnce();
    expect(() => vi.runAllTimers()).toThrow('subscriber failed');
  });

  it.each(['toString', 'constructor', '__proto__'])(
    'handles an event named after an Object property (%s)',
    name => {
      const callback = vi.fn();
      const arbiter = new Arbiter();

      arbiter.subscribe(name, callback);
      arbiter.inform(name, 1).clearSubscribers(name);

      expect(callback).toHaveBeenCalledWith(1);
    }
  );
});
