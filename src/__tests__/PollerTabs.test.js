import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Poller from '../Poller';
import TabLeader from '../core/TabLeader';
import { registerModules } from '../core/requireModule';
import '../ModuleRegistry';
import { asyncResponse, installFakeXHR } from '../__testutils__/fakeXHR';

class FakeLocks {
  constructor() {
    this.held = new Set();
    this.queues = new Map();
  }

  request(name, options, callback) {
    return new Promise((resolve, reject) => {
      const entry = { callback, resolve };
      const queue = this.queues.get(name) || [];
      this.queues.set(name, queue);
      options.signal.addEventListener('abort', () => {
        const index = queue.indexOf(entry);
        if (index !== -1) {
          queue.splice(index, 1);
          reject(new DOMException('Aborted', 'AbortError'));
        }
      });
      queue.push(entry);
      this.next(name);
    });
  }

  next(name) {
    const queue = this.queues.get(name) || [];
    if (this.held.has(name) || !queue.length) {
      return;
    }
    const entry = queue.shift();
    this.held.add(name);
    Promise.resolve(entry.callback({ name })).then(value => {
      this.held.delete(name);
      entry.resolve(value);
      this.next(name);
    });
  }
}

let channels;

class FakeBroadcastChannel {
  constructor(name) {
    this.name = name;
    this.closed = false;
    channels.push(this);
  }

  postMessage(data) {
    channels
      .filter(channel => channel !== this && channel.name === this.name && !channel.closed)
      .forEach(channel => channel.onmessage && channel.onmessage({ data: structuredClone(data) }));
  }

  close() {
    this.closed = true;
  }
}

let requests;
let pollers;
let hits;

beforeEach(() => {
  vi.useFakeTimers();
  requests = installFakeXHR();
  pollers = [];
  channels = [];
  hits = 0;
  registerModules({ Counter: { hit: () => (hits += 1) } });
  Object.defineProperty(navigator, 'locks', { configurable: true, value: new FakeLocks() });
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
});

afterEach(() => {
  pollers.forEach(poller => poller.destroy());
  setHidden(false);
  delete navigator.locks;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function tab(options) {
  const poller = new Poller({
    uri: '/notifications/poll',
    interval: 5000,
    shareAcrossTabs: true,
    ...options
  });
  pollers.push(poller);
  return poller;
}

async function flush() {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
}

function respond(index, response = {}) {
  requests[index].respond(200, asyncResponse({ payload: null, ...response }));
}

function setHidden(hidden) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('Poller shared across tabs', () => {
  it('sends the requests from the leader only, and the other tabs apply its responses', async () => {
    const first = tab();
    const second = tab();
    await flush();

    expect(first.isLeader()).toBe(true);
    expect(second.isLeader()).toBe(false);
    expect(requests).toHaveLength(1);

    respond(0, { jsmods: { require: [['Counter', 'hit', []]] } });
    expect(hits).toBe(2);

    vi.advanceTimersByTime(5000);
    expect(requests).toHaveLength(2);
  });

  it('does not share error responses', async () => {
    tab();
    tab();
    await flush();

    respond(0, { error: 1357001, jsmods: { require: [['Counter', 'hit', []]] } });

    expect(hits).toBe(1);
  });

  it('lets the next tab lead when the leader is closed', async () => {
    const first = tab();
    const second = tab();
    await flush();
    respond(0);

    first.destroy();
    await flush();

    expect(second.isLeader()).toBe(true);
    expect(requests).toHaveLength(2);
    expect(requests[1].url).toMatch(/^\/notifications\/poll\?__req=\d+$/);
  });

  it('gives up the lead while the page is hidden', async () => {
    const first = tab();
    await flush();
    respond(0);

    setHidden(true);
    await flush();
    expect(first.isLeader()).toBe(false);
    vi.advanceTimersByTime(20000);
    expect(requests).toHaveLength(1);

    setHidden(false);
    await flush();
    expect(first.isLeader()).toBe(true);
    expect(requests).toHaveLength(2);
  });

  it('shares only pollers of the same name', async () => {
    tab({ shareAcrossTabs: 'notifications' });
    tab({ shareAcrossTabs: 'messages' });
    tab({ shareAcrossTabs: false });
    await flush();

    expect(requests).toHaveLength(3);
  });

  it('polls in every tab without Web Locks', async () => {
    delete navigator.locks;

    const first = tab();
    tab();
    await flush();

    expect(TabLeader.isSupported()).toBe(false);
    expect(first.isLeader()).toBe(true);
    expect(requests).toHaveLength(2);
  });

  it('keeps the response handlers of setupRequest', async () => {
    const pre = vi.fn();
    const handler = vi.fn();
    tab({
      uri: null,
      shareAcrossTabs: 'custom',
      setupRequest: request =>
        request.setURI('/custom').setMethod('GET').setPreResponseHandler(pre).setHandler(handler)
    });
    tab({ shareAcrossTabs: 'custom', uri: '/custom' });
    await flush();

    respond(0, { jsmods: { require: [['Counter', 'hit', []]] } });

    expect(pre).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(hits).toBe(2);
  });

  it('shares by uri, and calls to the poller of the leader reach the poller of each tab', async () => {
    const first = tab({ id: 'poller_a' });
    const second = tab({ id: 'poller_b' });
    const third = tab();
    await flush();
    expect(requests).toHaveLength(1);

    respond(0, { jsmods: { require: [['poller_a', 'setInterval', [60000]]] } });

    expect(first.getInterval()).toBe(60000);
    expect(second.getInterval()).toBe(60000);
    expect(third.getInterval()).toBe(5000);
  });
});
