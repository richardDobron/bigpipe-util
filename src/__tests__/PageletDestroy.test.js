import { beforeEach, describe, expect, it, vi } from 'vitest';

let bigPipe;
let Arbiter;
let AsyncResponse;

// BigPipe is a singleton: every test gets fresh modules so pagelets do not leak between tests.
beforeEach(async () => {
  vi.resetModules();
  const { default: BigPipe } = await import('../BigPipe');
  ({ default: Arbiter } = await import('../core/Arbiter'));
  ({ default: AsyncResponse } = await import('../async/AsyncResponse'));
  bigPipe = new BigPipe();

  window.require = () => ({ init() {} });
  document.body.innerHTML = '<div id="pagelet_feed"></div><div id="pagelet_sidebar"></div>';
});

function arrive(id, html = id, isLast = true) {
  bigPipe.onPageletArrive({
    id,
    css: [],
    js: [],
    domops: [['setContent', '#pagelet_' + id, false, { __html: html }]],
    jsmods: { require: [] },
    ...(isLast ? { is_last: true } : {})
  });
  return bigPipe.pagelets.get(id);
}

describe('pagelet destructors', () => {
  it('knows its root once it is displayed', () => {
    const feed = arrive('feed');

    expect(feed.getRoot()).toBe(document.getElementById('pagelet_feed'));
  });

  it('runs the destructors once, also when one throws, and announces pagelet/destroy', () => {
    vi.useFakeTimers();
    const feed = arrive('feed', '<p>Posts</p>');
    const destructor = vi.fn();
    const destroyed = vi.fn();
    new Arbiter().subscribe('pagelet/destroy', destroyed);

    feed.addDestructor(() => {
      throw new Error('destructor failed');
    });
    feed.addDestructor(destructor);
    bigPipe.removePagelet(feed);
    bigPipe.removePagelet(feed);

    expect(destructor).toHaveBeenCalledOnce();
    expect(destroyed).toHaveBeenCalledWith({ id: 'feed', root: feed.getRoot() });
    expect(feed.getRoot().innerHTML).toBe('');
    expect(bigPipe.pagelets.has('feed')).toBe(false);
    expect(() => vi.runAllTimers()).toThrow('destructor failed');
    vi.useRealTimers();
  });

  it('runs a destructor added after the pagelet was destroyed right away', () => {
    const feed = arrive('feed');
    bigPipe.removePagelet(feed);
    const destructor = vi.fn();

    feed.addDestructor(destructor);

    expect(destructor).toHaveBeenCalledOnce();
  });

  it('destroys a pagelet that a pagelet with the same id replaces', () => {
    const old = arrive('feed', 'old');
    const destructor = vi.fn();
    old.addDestructor(destructor);

    const fresh = arrive('feed', 'new');

    expect(destructor).toHaveBeenCalledOnce();
    expect(bigPipe.pagelets.get('feed')).toBe(fresh);
    expect(document.getElementById('pagelet_feed').innerHTML).toBe('new');
  });

  it('destroys the pagelets inside a destroyed pagelet', () => {
    const feed = arrive('feed', '<div id="pagelet_comments"></div>', false);
    const comments = arrive('comments');
    const destructor = vi.fn();
    comments.addDestructor(destructor);

    bigPipe.removePagelet(feed);

    expect(destructor).toHaveBeenCalledOnce();
    expect(bigPipe.pagelets.has('comments')).toBe(false);
  });

  it('destroys the pagelets whose root a response removed', () => {
    const feed = arrive('feed', '<div id="pagelet_comments"></div>', false);
    const comments = arrive('comments', 'comments', false);
    const sidebar = arrive('sidebar');
    const destructor = vi.fn();
    comments.addDestructor(destructor);

    new AsyncResponse().handle({
      domops: [
        ['setContent', '#pagelet_feed', false, { __html: 'refreshed' }],
        ['remove', '#pagelet_sidebar', false, null]
      ]
    });

    expect(destructor).toHaveBeenCalledOnce();
    expect(bigPipe.pagelets.get('feed')).toBe(feed);
    expect(bigPipe.pagelets.has('comments')).toBe(false);
    expect(sidebar.destroyed).toBe(true);
    expect(bigPipe.pagelets.has('sidebar')).toBe(false);
  });

  it('does not display a replaced pagelet when its CSS loads later', () => {
    bigPipe.onPageletArrive({
      id: 'feed',
      css: ['/feed.css'],
      js: [],
      domops: [['setContent', '#pagelet_feed', false, { __html: 'old' }]],
      jsmods: {}
    });
    arrive('feed', 'new');

    bigPipe.fileLoaded(bigPipe.resolveResourceName('/feed.css'));

    expect(document.getElementById('pagelet_feed').innerHTML).toBe('new');
  });

  it('finds the pagelet of a node', () => {
    const feed = arrive('feed', '<ul><li id="post">Post</li></ul>');

    expect(bigPipe.getPageletForNode(document.getElementById('post'))).toBe(feed);
    expect(bigPipe.getPageletForNode(document.body)).toBeNull();
  });
});
