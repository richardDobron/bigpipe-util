import { beforeEach, describe, expect, it, vi } from 'vitest';

let bigPipe;
let tti;

// BigPipe is a singleton and the Bootloader keeps what it loaded: every test gets fresh modules.
beforeEach(async () => {
  vi.resetModules();
  const { default: BigPipe } = await import('../BigPipe');
  const { default: Arbiter } = await import('../core/Arbiter');
  bigPipe = new BigPipe();

  tti = vi.fn();
  new Arbiter().subscribe('BigPipe/tti', tti);

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

const preloads = () =>
  Array.from(document.querySelectorAll('link[rel="preload"]'), link => link.getAttribute('href'));

describe('time to interactive', () => {
  it('is informed once the pagelets of the phases up to tti_phase are displayed', () => {
    arrive('feed', { css: ['/feed.css'], tti_phase: 0 });
    arrive('sidebar', { phase: 1, is_last: true });
    expect(tti).not.toHaveBeenCalled();

    loadCss('/feed.css');

    expect(tti).toHaveBeenCalledOnce();
    expect(tti.mock.calls[0][0]).toMatchObject({ phase: 0, ts: expect.any(Number) });
    expect(bigPipe.ttiReached).toBe(true);
  });

  it('is informed once, not again for later pagelets', () => {
    arrive('feed', { tti_phase: 0 });
    arrive('sidebar', { phase: 1 });
    arrive('chat', { phase: 1, is_last: true });

    expect(tti).toHaveBeenCalledOnce();
  });

  it('waits until no pagelet of an earlier phase can arrive any more', () => {
    arrive('feed', { tti_phase: 0 });
    expect(tti).not.toHaveBeenCalled();

    arrive('sidebar', { is_last: true });

    expect(tti).toHaveBeenCalledOnce();
  });

  it('waits for the pagelets of every phase up to tti_phase', () => {
    arrive('feed', { tti_phase: 1 });
    arrive('sidebar', { phase: 1, css: ['/sidebar.css'] });
    arrive('chat', { phase: 2, is_last: true });
    expect(tti).not.toHaveBeenCalled();

    loadCss('/sidebar.css');

    expect(tti).toHaveBeenCalledOnce();
  });

  it('is a state, so a module that subscribes later is called too', async () => {
    const { default: Arbiter } = await import('../core/Arbiter');
    arrive('feed', { tti_phase: 0, is_last: true });
    const late = vi.fn();

    new Arbiter().subscribe('BigPipe/tti', late);

    expect(late).toHaveBeenCalledOnce();
  });

  it('is not informed without tti_phase', () => {
    arrive('feed');
    arrive('sidebar', { phase: 1, is_last: true });

    expect(tti).not.toHaveBeenCalled();
  });

  it('is forgotten for the next page', async () => {
    const { default: Arbiter } = await import('../core/Arbiter');
    arrive('feed', { tti_phase: 0, is_last: true });

    bigPipe.resetTti();

    expect(bigPipe.ttiReached).toBe(false);
    const late = vi.fn();
    new Arbiter().subscribe('BigPipe/tti', late);
    expect(late).not.toHaveBeenCalled();
    arrive('sidebar', { tti_phase: 0, is_last: true });
    expect(late).toHaveBeenCalledOnce();
  });
});

describe('second flush', () => {
  it('loads the JS files of the later phases right after the time to interactive', () => {
    arrive('feed', {
      css: ['/feed.css'],
      js: ['/feed.js'],
      tti_phase: 0
    });
    arrive('sidebar', { phase: 1, js: ['/sidebar.js'], allResources: ['/sidebar-dialog.js'] });
    arrive('chat', { phase: 2, js: ['/chat.js'], is_last: true });
    expect(preloads()).toEqual([]);

    loadCss('/feed.css');

    expect(preloads()).toEqual(['/sidebar.js', '/sidebar-dialog.js', '/chat.js']);
  });

  it('only downloads them, the scripts run when the pagelets load their JS', () => {
    arrive('feed', { tti_phase: 0 });
    arrive('sidebar', { phase: 1, css: ['/sidebar.css'], js: ['/sidebar.js'], is_last: true });

    expect(document.querySelector('link[rel="preload"]').getAttribute('as')).toBe('script');
    document.querySelector('link[rel="preload"]').onload();

    expect(document.querySelectorAll('script')).toHaveLength(0);
  });

  it('loads the JS files of a pagelet that arrives after the time to interactive', () => {
    arrive('feed', { tti_phase: 0 });
    arrive('sidebar', { phase: 1, css: ['/sidebar.css'] });
    expect(bigPipe.ttiReached).toBe(true);

    arrive('chat', { phase: 1, css: ['/chat.css'], js: ['/chat.js'], is_last: true });

    expect(preloads()).toEqual(['/chat.js']);
  });

  it('does not load the JS of the pagelets that are part of the time to interactive', () => {
    arrive('feed', { js: ['/feed.js'], tti_phase: 0 });
    arrive('sidebar', { phase: 1, is_last: true });

    expect(preloads()).toEqual([]);
  });
});

describe('last pagelet of a phase', () => {
  it('reaches the time to interactive without waiting for the next phase', () => {
    arrive('feed', { phase: 0, tti_phase: 0 });
    expect(tti).not.toHaveBeenCalled();

    arrive('sidebar', { phase: 0, tti_phase: 0, last_in_phase: true });

    expect(tti).toHaveBeenCalledOnce();
  });

  it('informs every phase once it arrived and is displayed, in their order', async () => {
    const { default: Arbiter } = await import('../core/Arbiter');
    const phases = [];
    new Arbiter().subscribe('BigPipe/phaseDisplayed', ({ phase }) => phases.push(phase));

    arrive('feed', { phase: 0, css: ['/feed.css'], last_in_phase: true });
    arrive('sidebar', { phase: 1, last_in_phase: true });
    expect(phases).toEqual([]);

    loadCss('/feed.css');
    expect(phases).toEqual([0, 1]);
    expect(bigPipe.isPhaseDisplayed(1)).toBe(true);

    arrive('chat', { phase: 2 });
    expect(phases).toEqual([0, 1]);

    arrive('__bigpipe_last', { phase: 2, is_last: true });
    expect(phases).toEqual([0, 1, 2]);
  });

  it('forgets the phases for the next page', async () => {
    arrive('feed', { phase: 0, last_in_phase: true });
    expect(bigPipe.isPhaseDisplayed(0)).toBe(true);

    bigPipe.startPage(1);

    expect(bigPipe.isPhaseDisplayed(0)).toBe(false);
  });
});
