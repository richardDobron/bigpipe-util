import { afterEach, describe, expect, it, vi } from 'vitest';
import Arbiter from '../Arbiter';

afterEach(() => {
  new Arbiter().clearSubscribers('ORDER/READY').clearState('ORDER/READY');
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

describe('state', () => {
  it('calls a callback subscribed after the state was informed', () => {
    const early = vi.fn();
    const late = vi.fn();
    const arbiter = new Arbiter();

    arbiter.subscribe('ORDER/READY', early);
    arbiter.informState('ORDER/READY', { id: 1 });
    arbiter.subscribe('ORDER/READY', late);

    expect(early).toHaveBeenCalledWith({ id: 1 });
    expect(late).toHaveBeenCalledWith({ id: 1 });
  });

  it('calls later subscribers with the last state', () => {
    const late = vi.fn();
    const arbiter = new Arbiter();

    arbiter.informState('ORDER/READY', 1);
    arbiter.informState('ORDER/READY', 2);
    arbiter.subscribe('ORDER/READY', late);

    expect(late).toHaveBeenCalledOnce();
    expect(late).toHaveBeenCalledWith(2);
  });

  it('does not remember events informed with inform()', () => {
    const late = vi.fn();
    const arbiter = new Arbiter();

    arbiter.inform('ORDER/READY', 1);
    arbiter.subscribe('ORDER/READY', late);

    expect(late).not.toHaveBeenCalled();
  });

  it('forgets a cleared state', () => {
    const late = vi.fn();
    const arbiter = new Arbiter();

    arbiter.informState('ORDER/READY', 1).clearState('ORDER/READY');
    arbiter.subscribe('ORDER/READY', late);

    expect(late).not.toHaveBeenCalled();
  });

  it('reports a late subscriber that throws and still subscribes it', () => {
    vi.useFakeTimers();
    const arbiter = new Arbiter();
    const callback = vi.fn(() => {
      throw new Error('late subscriber failed');
    });

    arbiter.informState('ORDER/READY', 1);
    const subscription = arbiter.subscribe('ORDER/READY', callback);
    arbiter.inform('ORDER/READY', 2);

    expect(callback).toHaveBeenCalledTimes(2);
    expect(typeof subscription.remove).toBe('function');
    expect(() => vi.runAllTimers()).toThrow('late subscriber failed');
  });
});
