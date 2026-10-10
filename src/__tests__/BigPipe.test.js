import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BigPipe, { BIGPIPE_PHASE, PAGELET_PHASE } from '../BigPipe';
import Bootloader from '../Bootloader';
import Pagelet from '../Pagelet';

beforeEach(() => {
  document.body.innerHTML = '<div id="slot">old</div>';
});

describe('BigPipe', () => {
  it('is a singleton', () => {
    expect(new BigPipe()).toBe(new BigPipe());
  });

  it('creates and registers a pagelet without a CommonJS require', () => {
    const bigPipe = new BigPipe();

    bigPipe.onPageletArrive({
      id: 'main',
      css: [],
      js: [],
      domops: [['setContent', '#slot', false, { __html: '<b>new</b>' }]],
      jsmods: { require: [] },
      is_last: true
    });

    const pagelet = bigPipe.pagelets.get('main');
    expect(pagelet).toBeInstanceOf(Pagelet);
    expect(pagelet.bigPipe).toBe(bigPipe);
    expect(pagelet.phase).toBe(PAGELET_PHASE.ARRIVE_END);
    expect(document.getElementById('slot').innerHTML).toBe('<b>new</b>');
    expect(bigPipe.phase).toBe(BIGPIPE_PHASE.COMPLETE);
  });

  it('still exports the phases for existing imports', async () => {
    const phases = await import('../BigPipePhases');

    expect(BIGPIPE_PHASE).toBe(phases.BIGPIPE_PHASE);
    expect(PAGELET_PHASE).toBe(phases.PAGELET_PHASE);
  });
});

describe('resources', () => {
  function arriveWithCss(bigPipe, id, css) {
    bigPipe.onPageletArrive({ id, css, js: [], domops: [], jsmods: { require: [] } });
  }

  it('loads files with the same name from different paths', () => {
    document.head.innerHTML = '';
    const bigPipe = new BigPipe();

    arriveWithCss(bigPipe, 'feed', ['/feed/main.css']);
    arriveWithCss(bigPipe, 'chat', ['/chat/main.css']);

    expect(
      Array.from(document.querySelectorAll('link'), link => link.getAttribute('href'))
    ).toEqual(['/feed/main.css', '/chat/main.css']);
  });

  it('loads the same file only once, also when written differently', () => {
    document.head.innerHTML = '';
    const bigPipe = new BigPipe();

    arriveWithCss(bigPipe, 'header', ['/shared/base.css']);
    arriveWithCss(bigPipe, 'footer', [window.location.origin + '/shared/base.css']);

    expect(document.querySelectorAll('link')).toHaveLength(1);
  });

  it('adds the CSP nonce of the page to the stylesheets and scripts it loads', () => {
    document.head.innerHTML = '<script nonce="r4nd0m"></script>';
    const bigPipe = new BigPipe();

    arriveWithCss(bigPipe, 'nonce', ['/nonce/a.css']);
    Bootloader.loadResources(['/nonce/a.js'], null, 'js');

    expect(document.querySelector('link[href="/nonce/a.css"]').getAttribute('nonce')).toBe(
      'r4nd0m'
    );
    expect(document.querySelector('script[src="/nonce/a.js"]').getAttribute('nonce')).toBe(
      'r4nd0m'
    );
  });

  it('adds no nonce when the page has none', () => {
    document.head.innerHTML = '';
    const bigPipe = new BigPipe();

    arriveWithCss(bigPipe, 'no-nonce', ['/no-nonce/a.css']);

    expect(document.querySelector('link[href="/no-nonce/a.css"]').hasAttribute('nonce')).toBe(
      false
    );
  });
});

describe('errors', () => {
  it('finishes a pagelet whose module calls fail', async () => {
    vi.resetModules();
    const { default: FreshBigPipe } = await import('../BigPipe');
    vi.useFakeTimers();
    const init = vi.fn();
    window.require = name => (name === 'Widget' ? { init } : {});

    try {
      const bigPipe = new FreshBigPipe();

      bigPipe.onPageletArrive({
        id: 'failing',
        css: [],
        js: [],
        domops: [],
        jsmods: {
          require: [
            ['Broken', 'init'],
            ['Widget', 'init']
          ]
        },
        is_last: true
      });

      expect(bigPipe.pagelets.get('failing').phase).toBe(PAGELET_PHASE.ARRIVE_END);
      expect(init).toHaveBeenCalledOnce();
      expect(() => vi.runAllTimers()).toThrow('Module Broken has no method "init"');
    } finally {
      delete window.require;
      vi.useRealTimers();
    }
  });
});

describe('lifecycle', () => {
  let bigPipe;
  let calls;

  // BigPipe is a singleton: every test gets a fresh module so pagelets do not leak between tests.
  beforeEach(async () => {
    vi.resetModules();
    const { default: FreshBigPipe } = await import('../BigPipe');
    bigPipe = new FreshBigPipe();

    calls = [];
    window.require = name => ({ init: () => calls.push(name) });
    document.head.innerHTML = '';
    document.body.innerHTML = '<div id="a"></div><div id="b"></div>';
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
  });

  afterEach(() => {
    // Flushes the load listeners of this test, so they cannot fire in the next one.
    window.dispatchEvent(new Event('load'));
    vi.restoreAllMocks();
    delete window.require;
  });

  function arrive(id, { css = [], js = [], isLast = false, afterLoad = false } = {}) {
    bigPipe.onPageletArrive({
      id,
      css,
      js,
      domops: [['setContent', '#' + id, false, { __html: id.toUpperCase() }]],
      jsmods: { require: [[id + 'Module', 'init']] },
      ...(afterLoad ? { onafterload: { require: [[id + 'AfterLoad', 'init']] } } : {}),
      ...(isLast ? { is_last: true } : {})
    });
  }

  const load = selector => document.querySelector(selector).onload();
  const content = id => document.getElementById(id).innerHTML;

  it('displays a pagelet once its stylesheet is loaded and then runs its jsmods', () => {
    arrive('a', { css: ['/a.css'], isLast: true });
    expect(content('a')).toBe('');

    load('link[href="/a.css"]');

    expect(content('a')).toBe('A');
    expect(calls).toEqual(['aModule']);
  });

  it('loads the JS files only after every pagelet is displayed', () => {
    arrive('a', { js: ['/a.js'] });
    arrive('b', { css: ['/b.css'], isLast: true });
    expect(document.querySelector('script[src="/a.js"]')).toBeNull();

    load('link[href="/b.css"]');
    expect(document.querySelector('script[src="/a.js"]')).not.toBeNull();
    expect(calls).toEqual(['bModule']);

    load('script[src="/a.js"]');
    expect(calls).toEqual(['bModule', 'aModule']);
  });

  it('runs the jsmods only after the last pagelet arrived, in arrival order', () => {
    arrive('a');
    expect(content('a')).toBe('A');
    expect(calls).toEqual([]);

    arrive('b', { isLast: true });
    expect(calls).toEqual(['aModule', 'bModule']);
  });

  it('displays a pagelet whose stylesheet another pagelet already loaded', () => {
    arrive('a', { css: ['/shared.css'] });
    load('link[href="/shared.css"]');

    arrive('b', { css: ['/shared.css'], isLast: true });

    expect(document.querySelectorAll('link').length).toBe(1);
    expect(content('b')).toBe('B');
    expect(calls).toEqual(['aModule', 'bModule']);
  });

  it('runs the onafterload jsmods after all jsmods, once the window has loaded', () => {
    arrive('a', { js: ['/a.js'], afterLoad: true });
    arrive('b', { isLast: true, afterLoad: true });
    window.dispatchEvent(new Event('load'));
    expect(calls).toEqual(['bModule']);
    expect(bigPipe.phase).toBe(BIGPIPE_PHASE.LOADING_JS);

    load('script[src="/a.js"]');
    expect(bigPipe.phase).toBe(BIGPIPE_PHASE.COMPLETE);
    expect(calls).toEqual(['bModule', 'aModule']);

    window.dispatchEvent(new Event('load'));
    expect(calls).toEqual(['bModule', 'aModule', 'aAfterLoad', 'bAfterLoad']);
  });

  it('runs a pagelet that arrives after the page finished, and its onafterload only', () => {
    arrive('a', { isLast: true, afterLoad: true });
    window.dispatchEvent(new Event('load'));
    expect(calls).toEqual(['aModule', 'aAfterLoad']);

    arrive('b', { isLast: true, afterLoad: true });
    window.dispatchEvent(new Event('load'));

    expect(content('b')).toBe('B');
    expect(calls).toEqual(['aModule', 'aAfterLoad', 'bModule', 'bAfterLoad']);
    expect(bigPipe.phase).toBe(BIGPIPE_PHASE.COMPLETE);
  });

  it('runs the onafterload jsmods right away when the window is already loaded', async () => {
    vi.restoreAllMocks();
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');

    arrive('a', { isLast: true, afterLoad: true });
    expect(calls).toEqual(['aModule']);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(calls).toEqual(['aModule', 'aAfterLoad']);
  });
});

describe('Pagelet', () => {
  it('requires the BigPipe that received it', () => {
    expect(() => new Pagelet({ id: 'orphan' })).toThrow(
      'Pagelet "orphan" has to be created by BigPipe.onPageletArrive().'
    );
  });
});
