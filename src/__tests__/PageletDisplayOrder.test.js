import { beforeEach, describe, expect, it, vi } from 'vitest';

let bigPipe;
let displayed;

// BigPipe is a singleton: every test gets fresh modules so pagelets do not leak between tests.
beforeEach(async () => {
  vi.resetModules();
  const { default: BigPipe } = await import('../BigPipe');
  const { default: Arbiter } = await import('../core/Arbiter');
  bigPipe = new BigPipe();

  displayed = [];
  new Arbiter().subscribe('Pagelet/event', ({ event, id }) => {
    if (event === 'display') {
      displayed.push(id);
    }
  });

  document.head.innerHTML = '';
  document.body.innerHTML =
    '<div id="pagelet_feed"></div><div id="pagelet_sidebar"></div><div id="pagelet_chat"></div>';
});

function arrive(id, data = {}) {
  bigPipe.onPageletArrive({
    id,
    css: [],
    js: [],
    domops: [['setContent', '#pagelet_' + id, false, { __html: id }]],
    jsmods: {},
    ...data
  });
}

function loadCss(file) {
  bigPipe.fileLoaded(bigPipe.resolveResourceName(file));
}

describe('display order', () => {
  it('displays a pagelet after the pagelets of a lower phase', () => {
    arrive('feed', { css: ['/feed.css'] });
    arrive('sidebar', { phase: 1, is_last: true });
    expect(displayed).toEqual([]);

    loadCss('/feed.css');

    expect(displayed).toEqual(['feed', 'sidebar']);
    expect(bigPipe.pagelets.get('sidebar').isComplete()).toBe(true);
  });

  it('does not wait for pagelets of the same or a higher phase', () => {
    arrive('feed', { phase: 1, css: ['/feed.css'] });
    arrive('sidebar', { phase: 1 });
    arrive('chat', { is_last: true });

    expect(displayed).toEqual(['sidebar', 'chat']);
  });

  it('displays a pagelet after its display dependencies, also when they arrive later', () => {
    arrive('chat', { display_dependency: ['feed', 'sidebar'] });
    arrive('feed');
    expect(displayed).toEqual(['feed']);

    arrive('sidebar', { css: ['/sidebar.css'], is_last: true });
    loadCss('/sidebar.css');

    expect(displayed).toEqual(['feed', 'sidebar', 'chat']);
  });

  it('stops waiting for a pagelet of a lower phase that was destroyed', () => {
    arrive('feed', { css: ['/feed.css'] });
    arrive('sidebar', { phase: 1 });

    bigPipe.removePagelet(bigPipe.pagelets.get('feed'));

    expect(displayed).toEqual(['sidebar']);
  });
});
