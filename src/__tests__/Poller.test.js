import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Poller from '../Poller';
import ServerJS from '../ServerJS';
import Arbiter from '../core/Arbiter';
import '../ModuleRegistry';
import { asyncResponse, installFakeXHR } from '../__testutils__/fakeXHR';

let requests;
let pollers;

beforeEach(() => {
  vi.useFakeTimers();
  requests = installFakeXHR();
  pollers = [];
  document.body.innerHTML = '<span id="count">0</span>';
});

afterEach(() => {
  pollers.forEach(poller => poller.destroy());
  setHidden(false);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function poller(options) {
  const created = new Poller({ uri: '/notifications/poll', interval: 5000, ...options });
  pollers.push(created);
  return created;
}

function respond(index, response = {}) {
  requests[index].respond(200, asyncResponse({ payload: null, ...response }));
}

function setHidden(hidden) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('Poller', () => {
  it('sends the next request an interval after the last one finished and applies the responses', () => {
    poller({ data: { since: 7 } });

    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('GET');
    expect(requests[0].url).toMatch(/^\/notifications\/poll\?since=7&__req=\d+$/);

    respond(0, { domops: [['setContent', '#count', false, { __html: '3' }]] });
    expect(document.getElementById('count').innerHTML).toBe('3');

    vi.advanceTimersByTime(4999);
    expect(requests).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(requests).toHaveLength(2);
  });

  it('waits at least two seconds, takes the interval from a function and stops after maxRequests', () => {
    const done = vi.fn();
    const interval = vi.fn(() => 100);
    const created = poller({ interval, maxRequests: 2 });
    created.subscribe('done', done);

    respond(0);
    expect(interval).toHaveBeenCalledWith(1);
    vi.advanceTimersByTime(1999);
    expect(requests).toHaveLength(1);
    vi.advanceTimersByTime(1);
    respond(1);

    expect(requests).toHaveLength(2);
    expect(done).toHaveBeenCalledWith({ sender: created });
    expect(created.isPolling()).toBe(false);
  });

  it('sets up every request with setupRequest', () => {
    const handler = vi.fn();
    poller({
      uri: null,
      setupRequest: (request, sender) => request.setURI('/custom').setHandler(handler)
    });

    respond(0);

    expect(requests[0].url).toMatch(/^\/custom/);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('goes on polling when setupRequest sets a finally handler', () => {
    const finallyHandler = vi.fn();
    poller({ setupRequest: request => request.setFinallyHandler(finallyHandler) });

    respond(0);
    expect(finallyHandler).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(5000);
    expect(requests).toHaveLength(2);
  });

  it('pauses while the page is hidden', () => {
    poller();
    respond(0);

    setHidden(true);
    vi.advanceTimersByTime(5000);
    expect(requests).toHaveLength(1);

    setHidden(false);
    expect(requests).toHaveLength(2);
  });

  it('pauses while the user is idle', () => {
    poller({ muteWhenIdle: 8000 });
    respond(0);

    vi.advanceTimersByTime(5000);
    expect(requests).toHaveLength(2);
    respond(1);

    vi.advanceTimersByTime(5000);
    expect(requests).toHaveLength(2);

    document.documentElement.dispatchEvent(new MouseEvent('mousemove'));
    expect(requests).toHaveLength(3);
  });

  it('stops, skips a request, and restarts with reset()', () => {
    const created = poller();
    respond(0);

    created.skip();
    vi.advanceTimersByTime(5000);
    expect(requests).toHaveLength(1);
    vi.advanceTimersByTime(5001);
    expect(requests).toHaveLength(2);

    created.stop();
    expect(requests[1].aborted).toBe(true);
    vi.advanceTimersByTime(20000);
    expect(requests).toHaveLength(2);

    created.reset();
    expect(requests).toHaveLength(3);
  });

  it('is controlled by the server through its id', () => {
    new ServerJS().handle({
      require: [
        [
          'bigpipe-util/dist/Poller',
          null,
          [{ id: 'poller_notifications', uri: '/notifications/poll', interval: 5000 }]
        ]
      ]
    });
    expect(requests[0].url).toContain('__poller=poller_notifications');

    respond(0, { jsmods: { require: [['poller_notifications', 'setInterval', [30000]]] } });

    vi.advanceTimersByTime(29999);
    expect(requests).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(requests).toHaveLength(2);

    respond(1, { jsmods: { require: [['poller_notifications', 'stop']] } });
    vi.advanceTimersByTime(60000);
    expect(requests).toHaveLength(2);
  });

  it('ends with the page on a page transition, unless told otherwise', () => {
    poller();
    poller({ uri: '/presence', clearOnQuicklingEvents: false });
    respond(0);
    respond(1);

    new Arbiter().inform('Quickling/unload', { transition_type: 'quickling' });
    vi.advanceTimersByTime(5000);

    expect(requests.map(request => request.url.split('?')[0])).toEqual([
      '/notifications/poll',
      '/presence',
      '/presence'
    ]);
  });
});
