import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let bigPipe;
let Arbiter;
let BIGPIPE_PHASE;

// BigPipe is a singleton: every test gets fresh modules so pagelets do not leak between tests.
beforeEach(async () => {
  vi.resetModules();
  let BigPipe;
  ({ default: BigPipe, BIGPIPE_PHASE } = await import('../BigPipe'));
  ({ default: Arbiter } = await import('../core/Arbiter'));
  bigPipe = new BigPipe();

  window.require = () => ({ init() {} });
  document.body.innerHTML = '<div id="pagelet_feed"></div><div id="pagelet_sidebar"></div>';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  delete window.require;
});

const pagelet = (id, data = {}) => ({
  id,
  css: [],
  js: [],
  domops: [['setContent', '#pagelet_' + id, false, { __html: id }]],
  jsmods: {},
  ...data
});

describe('pagelet errors', () => {
  it('reports a pagelet whose DOM operations fail and goes on with the page', () => {
    const failed = vi.fn();
    new Arbiter().subscribe('pagelet/error', failed);
    const init = vi.fn();
    window.require = () => ({ init });

    bigPipe.onPageletArrive(
      pagelet('feed', {
        domops: [['setContent', '#pagelet_feed', false, null]],
        jsmods: { require: [['Feed', 'init']] }
      })
    );
    bigPipe.onPageletArrive(pagelet('sidebar', { is_last: true }));

    expect(failed).toHaveBeenCalledWith({ id: 'feed', error: expect.any(TypeError) });
    expect(bigPipe.pagelets.get('feed').error).toBeInstanceOf(TypeError);
    expect(init).toHaveBeenCalledOnce();
    expect(document.getElementById('pagelet_sidebar').innerHTML).toBe('sidebar');
    expect(bigPipe.phase).toBe(BIGPIPE_PHASE.COMPLETE);
    expect(() => vi.runAllTimers()).toThrow(TypeError);
  });

  it('reports a pagelet that fails to arrive and goes on with the next one', () => {
    expect(() => bigPipe.onPageletArrive(pagelet('feed', { css: 'feed.css' }))).not.toThrow();

    bigPipe.onPageletArrive(pagelet('sidebar'));

    expect(document.getElementById('pagelet_sidebar').innerHTML).toBe('sidebar');
    expect(() => vi.runAllTimers()).toThrow();
  });
});
