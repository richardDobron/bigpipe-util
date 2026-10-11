import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let bigPipe;
let Arbiter;
let PAGELET_EVENT;
let BIGPIPE_EVENT;

// BigPipe is a singleton: every test gets fresh modules so pagelets do not leak between tests.
beforeEach(async () => {
  vi.resetModules();
  let BigPipe;
  ({ default: BigPipe, BIGPIPE_EVENT, PAGELET_EVENT } = await import('../BigPipe'));
  ({ default: Arbiter } = await import('../core/Arbiter'));
  bigPipe = new BigPipe();

  window.require = () => ({ init() {} });
  document.head.innerHTML = '';
  document.body.innerHTML = '<div id="pagelet_feed"></div>';
});

afterEach(() => {
  vi.restoreAllMocks();
  delete window.require;
});

describe('pagelet events', () => {
  it('informs pagelet_event with the time of every lifecycle event', () => {
    const mark = vi.spyOn(performance, 'mark');
    const events = [];
    new Arbiter().subscribe('pagelet_event', data => events.push(data));

    bigPipe.onPageletArrive({
      id: 'feed',
      css: ['/feed.css'],
      js: ['/feed.js'],
      domops: [['setContent', '#pagelet_feed', false, { __html: 'Posts' }]],
      jsmods: { require: [['Feed', 'init']] },
      is_last: true
    });
    expect(events.map(({ event }) => event)).toEqual([PAGELET_EVENT.ARRIVE, PAGELET_EVENT.CSS]);

    bigPipe.fileLoaded(bigPipe.resolveResourceName('/feed.css'));
    bigPipe.fileLoaded(bigPipe.resolveResourceName('/feed.js'));

    expect(events.map(({ event }) => event)).toEqual([
      'arrive',
      'css',
      'css_load',
      'display_start',
      'display',
      'jsstart',
      'jsdone',
      'onload'
    ]);
    expect(events.every(({ id }) => id === 'feed')).toBe(true);

    const { timings } = bigPipe.pagelets.get('feed');
    expect(Object.keys(timings)).toHaveLength(8);
    expect(timings.onload).toBeGreaterThanOrEqual(timings.arrive);
    expect(events[7].ts).toBe(timings.onload);
    expect(mark).toHaveBeenCalledWith('pagelet_feed_display');
  });
});

describe('page events', () => {
  it('informs the page events as states, so a later subscriber gets them too', () => {
    const events = {};
    const arbiter = new Arbiter();
    Object.values(BIGPIPE_EVENT).forEach(event => {
      arbiter.subscribe(event, data => (events[event] = data));
    });
    expect(Object.keys(events)).toEqual([BIGPIPE_EVENT.INIT]);

    bigPipe.onPageletArrive({
      id: 'feed',
      css: [],
      js: ['/feed.js'],
      domops: [['setContent', '#pagelet_feed', false, { __html: 'Posts' }]],
      jsmods: { require: [['Feed', 'init']] },
      is_last: true
    });
    expect(Object.keys(events)).toEqual(['BigPipe/init', 'all_pagelets_displayed']);

    bigPipe.fileLoaded(bigPipe.resolveResourceName('/feed.js'));
    expect(Object.keys(events)).toEqual([
      'BigPipe/init',
      'all_pagelets_displayed',
      'all_pagelets_loaded'
    ]);
    expect(events.all_pagelets_loaded.ts).toBeGreaterThanOrEqual(events['BigPipe/init'].ts);

    const late = vi.fn();
    arbiter.subscribe(BIGPIPE_EVENT.LOADED, late);
    expect(late).toHaveBeenCalledWith(events.all_pagelets_loaded);
  });
});

describe('pagelets of a response', () => {
  const pagelet = (id, fields = {}) => ({
    id,
    css: [],
    js: [],
    domops: [['setContent', `#pagelet_${id}`, false, { __html: id }]],
    jsmods: {},
    ...fields
  });

  it('do not start the JS of the page or inform its events', () => {
    document.body.innerHTML = '<div id="pagelet_feed"></div><div id="pagelet_lazy"></div>';
    const informed = vi.fn();
    const arbiter = new Arbiter();
    arbiter.subscribe(BIGPIPE_EVENT.DISPLAYED, informed);
    arbiter.subscribe(BIGPIPE_EVENT.LOADED, informed);

    bigPipe.onPageletArrive(pagelet('feed', { js: ['/feed.js'] }));
    bigPipe.onPageletArrive(pagelet('lazy', { js: ['/lazy.js'], is_last: true }), 1);

    expect(document.getElementById('pagelet_lazy').innerHTML).toBe('lazy');
    expect(document.querySelector('script[src="/lazy.js"]')).not.toBeNull();
    expect(document.querySelector('script[src="/feed.js"]')).toBeNull();
    expect(informed).not.toHaveBeenCalled();

    bigPipe.fileLoaded(bigPipe.resolveResourceName('/lazy.js'));
    expect(bigPipe.pagelets.get('lazy').isComplete()).toBe(true);
    expect(informed).not.toHaveBeenCalled();
  });

  it('do not inform the events of a page that has loaded again', () => {
    document.body.innerHTML = '<div id="pagelet_feed"></div><div id="pagelet_lazy"></div>';
    bigPipe.onPageletArrive(pagelet('feed', { is_last: true }));
    const informed = vi.fn();
    const arbiter = new Arbiter();
    arbiter.subscribe(BIGPIPE_EVENT.DISPLAYED, informed);
    arbiter.subscribe(BIGPIPE_EVENT.LOADED, informed);
    informed.mockClear();

    bigPipe.onPageletArrive(pagelet('lazy', { is_last: true }), 1);

    expect(bigPipe.pagelets.get('lazy').isComplete()).toBe(true);
    expect(informed).not.toHaveBeenCalled();
  });

  it('are displayed in the order of their phases, apart from the pagelets of the page', () => {
    document.body.innerHTML =
      '<div id="pagelet_slow"></div><div id="pagelet_first"></div><div id="pagelet_second"></div>';

    bigPipe.onPageletArrive(pagelet('slow', { phase: 0, css: ['/slow.css'] }));
    bigPipe.onPageletArrive(pagelet('first', { phase: 0, css: ['/first.css'] }), 1);
    bigPipe.onPageletArrive(pagelet('second', { phase: 1, is_last: true }), 1);
    expect(document.getElementById('pagelet_second').innerHTML).toBe('');

    bigPipe.fileLoaded(bigPipe.resolveResourceName('/first.css'));
    expect(document.getElementById('pagelet_first').innerHTML).toBe('first');
    expect(document.getElementById('pagelet_second').innerHTML).toBe('second');
    expect(document.getElementById('pagelet_slow').innerHTML).toBe('');
  });

  it('are the page once a page transition starts it', () => {
    const informed = vi.fn();
    new Arbiter().subscribe(BIGPIPE_EVENT.LOADED, informed);

    bigPipe.startPage(7);
    bigPipe.onPageletArrive(pagelet('feed', { is_last: true }), 7);

    expect(informed).toHaveBeenCalledOnce();
  });
});
