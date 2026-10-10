import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { asyncResponse, installFakeXHR } from '../__testutils__/fakeXHR';

let UIPagelet;
let BigPipe;
let ServerJS;
let requests;
let observers;

class FakeIntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.elements = [];
    observers.push(this);
  }

  observe(element) {
    this.elements.push(element);
  }

  disconnect() {
    this.disconnected = true;
  }

  show() {
    this.callback(this.elements.map(target => ({ target, isIntersecting: true })));
  }
}

// BigPipe is a singleton: every test gets fresh modules so pagelets do not leak between tests.
beforeEach(async () => {
  vi.resetModules();
  ({ default: UIPagelet } = await import('../UIPagelet'));
  ({ default: ServerJS } = await import('../ServerJS'));
  ({ default: BigPipe } = await import('../BigPipe'));
  await import('../ModuleRegistry');

  requests = installFakeXHR();
  observers = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  document.head.innerHTML = '';
  document.body.innerHTML = '<div id="pagelet_feed">Loading…</div>';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('UIPagelet.loadFromEndpoint', () => {
  it('loads the pagelet when its placeholder becomes visible', () => {
    UIPagelet.loadFromEndpoint('/pagelets/feed', 'pagelet_feed', { page: 2 });
    expect(requests).toHaveLength(0);
    expect(observers[0].options).toEqual({ rootMargin: '300px' });

    observers[0].show();

    expect(requests[0].method).toBe('GET');
    expect(requests[0].url).toMatch(/^\/pagelets\/feed\?page=2&__req=\d+$/);
    expect(document.getElementById('pagelet_feed').className).toBe('async-saving');
  });

  it('loads right away or when the browser is idle', () => {
    const idle = [];
    vi.stubGlobal('requestIdleCallback', callback => idle.push(callback));
    document.body.innerHTML = '<div id="pagelet_a"></div><div id="pagelet_b"></div>';

    UIPagelet.loadFromEndpoint('/a', 'pagelet_a', [], { load: 'load' });
    UIPagelet.loadFromEndpoint('/b', 'pagelet_b', [], { load: 'idle' });
    expect(requests).toHaveLength(1);

    idle.forEach(callback => callback());
    expect(requests).toHaveLength(2);
  });

  it('warns and does nothing when the placeholder is not on the page', () => {
    vi.stubGlobal('__DEV__', true);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    UIPagelet.loadFromEndpoint('/pagelets/feed', 'pagelet_missing', {}, { load: 'load' });

    expect(requests).toHaveLength(0);
    expect(consoleError).toHaveBeenCalledWith(
      "Warning: UIPagelet: the placeholder 'pagelet_missing' is not on the page."
    );
    consoleError.mockRestore();
  });

  it('stops waiting and aborts the request when the pagelet it is in is destroyed', () => {
    window.require = () => ({});
    document.body.innerHTML = '<div id="pagelet_home"></div>';
    const bigPipe = new BigPipe();
    bigPipe.onPageletArrive({
      id: 'home',
      css: [],
      js: [],
      domops: [
        [
          'setContent',
          '#pagelet_home',
          false,
          { __html: '<div id="pagelet_a"></div><div id="pagelet_b"></div>' }
        ]
      ],
      jsmods: {},
      is_last: true
    });

    UIPagelet.loadFromEndpoint('/a', 'pagelet_a');
    UIPagelet.loadFromEndpoint('/b', 'pagelet_b', {}, { load: 'load' });
    bigPipe.removePagelet(bigPipe.pagelets.get('home'));

    expect(observers[0].disconnected).toBe(true);
    expect(requests[0].aborted).toBe(true);
    delete window.require;
  });

  it('is called by the server and fills the placeholder with the pagelet of the response', () => {
    window.require = name => ({ init: () => document.body.setAttribute('data-feed', name) });

    new ServerJS().handle({
      require: [
        [
          'bigpipe-util/dist/UIPagelet',
          'loadFromEndpoint',
          ['/pagelets/feed', 'pagelet_feed', [], { load: 'load' }]
        ]
      ]
    });
    requests[0].respond(
      200,
      asyncResponse({
        domops: [['replace', '', true, { __html: '<div id="pagelet_feed"></div>' }]],
        pagelets: [
          {
            id: 'feed',
            css: [],
            js: [],
            domops: [['setContent', '#pagelet_feed', false, { __html: '<ul>Posts</ul>' }]],
            jsmods: { require: [['Feed', 'init']] },
            is_last: true
          }
        ]
      })
    );

    expect(document.getElementById('pagelet_feed').innerHTML).toBe('<ul>Posts</ul>');
    expect(document.body.getAttribute('data-feed')).toBe('Feed');
    delete window.require;
  });
});
