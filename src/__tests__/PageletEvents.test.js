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
