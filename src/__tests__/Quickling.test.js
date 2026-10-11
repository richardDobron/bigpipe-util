import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { asyncResponse, installFakeXHR } from '../__testutils__/fakeXHR';

vi.mock('../core/goOrReplace', () => ({ default: vi.fn() }));

let Quickling;
let PageTransitions;
let BigPipe;
let TimerStorage;
let goOrReplace;
let requests;
let canvas;

// Every test gets fresh modules; the tests go to pages with go(), so the document listeners of
// earlier tests do not get any event.
beforeEach(async () => {
  vi.resetModules();
  ({ default: Quickling } = await import('../Quickling'));
  ({ default: PageTransitions } = await import('../PageTransitions'));
  ({ default: BigPipe } = await import('../BigPipe'));
  TimerStorage = await import('../core/TimerStorage');
  ({ default: goOrReplace } = await import('../core/goOrReplace'));

  window.scrollTo = vi.fn();
  window.require = () => ({});
  window.history.replaceState(null, '', '/home');
  requests = installFakeXHR();
  document.title = 'Home';
  document.body.className = 'home';
  document.body.innerHTML =
    '<header></header><div id="content"><div id="pagelet_home"></div></div>';
  canvas = document.getElementById('content');
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete window.require;
});

const href = path => window.location.origin + path;

function feedResponse(payload = {}) {
  return asyncResponse({
    payload: { title: 'Feed', body_class: 'feed', version: 'v1', ...payload },
    domops: [['setContent', '', true, { __html: '<div id="pagelet_feed"></div>' }]],
    pagelets: [
      {
        id: 'feed',
        css: [],
        js: [],
        domops: [['setContent', '#pagelet_feed', false, { __html: 'Posts' }]],
        jsmods: {},
        is_last: true
      }
    ],
    jsmods: {}
  });
}

describe('Quickling', () => {
  it('loads the next page into the canvas', () => {
    const bigPipe = new BigPipe();
    bigPipe.onPageletArrive({
      id: 'home',
      css: [],
      js: [],
      domops: [['setContent', '#pagelet_home', false, { __html: 'Welcome' }]],
      jsmods: {},
      is_last: true
    });
    const destructor = vi.fn();
    bigPipe.pagelets.get('home').addDestructor(destructor);
    const interval = vi.fn();
    vi.useFakeTimers();
    TimerStorage.setInterval(interval, 10);
    const complete = vi.spyOn(PageTransitions, 'transitionComplete');

    try {
      Quickling.init(canvas, { version: 'v1' });
      PageTransitions.go('/feed');
      vi.advanceTimersByTime(50);
    } finally {
      vi.useRealTimers();
    }

    expect(interval).not.toHaveBeenCalled();
    expect(requests[0].method).toBe('GET');
    expect(requests[0].url).toMatch(/\/feed\?quickling%5Bversion%5D=v1&__stream=1&__req=\d+$/);
    expect(window.location.pathname).toBe('/feed');

    requests[0].respond(200, feedResponse());

    expect(destructor).toHaveBeenCalledOnce();
    expect(bigPipe.pagelets.has('home')).toBe(false);
    expect(canvas.innerHTML).toBe('<div id="pagelet_feed">Posts</div>');
    expect(document.title).toBe('Feed');
    expect(document.body.className).toBe('feed');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(complete).toHaveBeenCalledOnce();
  });

  it('shows the parts of a streamed page as they arrive and completes after the last one', () => {
    const complete = vi.spyOn(PageTransitions, 'transitionComplete');
    const part = (content, finished = false) =>
      JSON.stringify({ content, finished }) + '/*<!-- fetch-stream -->*/';
    const pagelet = (id, extra = {}) => ({
      id,
      css: [],
      js: [],
      domops: [['setContent', '#pagelet_' + id, false, { __html: id }]],
      jsmods: {},
      ...extra
    });

    Quickling.init(canvas, { version: 'v1' });
    PageTransitions.go('/feed');

    let body = part({
      payload: { title: 'Feed', version: 'v1' },
      domops: [
        [
          'setContent',
          '',
          true,
          { __html: '<div id="pagelet_feed"></div><div id="pagelet_ads"></div>' }
        ]
      ]
    });
    requests[0].progress(200, body);
    expect(document.title).toBe('Feed');
    expect(canvas.innerHTML).toBe('<div id="pagelet_feed"></div><div id="pagelet_ads"></div>');

    body += part({ pagelets: [pagelet('feed')] });
    requests[0].progress(200, body);
    expect(document.getElementById('pagelet_feed').innerHTML).toBe('feed');
    expect(complete).not.toHaveBeenCalled();

    body += part({ pagelets: [pagelet('ads', { is_last: true })] }, true);
    requests[0].respond(200, body);
    expect(document.getElementById('pagelet_ads').innerHTML).toBe('ads');
    expect(complete).toHaveBeenCalledOnce();
  });

  it('forgets that the pagelets of the previous page were displayed and loaded', async () => {
    const { default: Arbiter } = await import('../core/Arbiter');
    new BigPipe().inform('BigPipe/allPageletsDisplayed');
    new BigPipe().inform('BigPipe/allPageletsLoaded');
    Quickling.init(canvas, { version: 'v1' });
    PageTransitions.go('/feed');

    requests[0].respond(
      200,
      asyncResponse({
        payload: { title: 'Feed', version: 'v1' },
        domops: [['setContent', '', true, { __html: '<div id="pagelet_feed"></div>' }]]
      })
    );
    const informed = vi.fn();
    new Arbiter().subscribe('BigPipe/allPageletsDisplayed', informed);
    new Arbiter().subscribe('BigPipe/allPageletsLoaded', informed);

    expect(document.title).toBe('Feed');
    expect(informed).not.toHaveBeenCalled();
  });

  it('keeps the title and the class of the body when the response has none', () => {
    Quickling.init(canvas, { version: 'v1' });
    PageTransitions.go('/feed');

    requests[0].respond(200, feedResponse({ title: null, body_class: null }));

    expect(canvas.innerHTML).toBe('<div id="pagelet_feed">Posts</div>');
    expect(document.title).toBe('Home');
    expect(document.body.className).toBe('home');
  });

  it('informs the events of the next page, but not for a lazy pagelet of the page', async () => {
    const { default: Arbiter } = await import('../core/Arbiter');
    const { default: AsyncRequest } = await import('../async/AsyncRequest');
    const loaded = vi.fn();
    new Arbiter().subscribe('BigPipe/allPageletsLoaded', loaded);
    Quickling.init(canvas, { version: 'v1' });
    PageTransitions.go('/feed');

    requests[0].respond(200, feedResponse());
    expect(loaded).toHaveBeenCalledOnce();

    document.getElementById('pagelet_feed').innerHTML = '<div id="pagelet_lazy"></div>';
    new AsyncRequest('/lazy').setAllowCrossPageTransition(true).send();
    requests[1].respond(
      200,
      asyncResponse({
        pagelets: [{ id: 'lazy', css: [], js: [], domops: [], jsmods: {}, is_last: true }]
      })
    );
    expect(new BigPipe().pagelets.get('lazy').isComplete()).toBe(true);
    expect(loaded).toHaveBeenCalledOnce();
  });

  it('loads the next page in full once a response came from a newer deploy', async () => {
    const { default: AsyncResponse } = await import('../async/AsyncResponse');
    const { default: ServerJS } = await import('../ServerJS');
    new ServerJS().handle({ define: [['BigPipeRevision', 'r1']] });
    Quickling.init(canvas, { version: 'r1' });

    new AsyncResponse().handle({ revision: 'r2' });
    PageTransitions.go('/feed');

    expect(requests).toHaveLength(0);
    expect(goOrReplace).toHaveBeenCalledWith(window.location, href('/feed'), false);
  });

  it('loads a page of another version in full', () => {
    Quickling.init(canvas, { version: 'v1' });
    PageTransitions.go('/feed');

    requests[0].respond(200, feedResponse({ version: 'v2', uri: '/feed?quickling[version]=v1' }));

    expect(goOrReplace).toHaveBeenCalledWith(window.location, href('/feed'), true);
    expect(canvas.innerHTML).toBe('<div id="pagelet_home"></div>');
    expect(document.title).toBe('Home');
  });

  it('follows a redirect with a page transition, or in full when forced', () => {
    Quickling.init(canvas, { version: 'v1' });
    PageTransitions.go('/old');

    requests[0].respond(200, asyncResponse({ payload: { redirect: '/new' } }));
    expect(requests[1].url).toContain('/new?');

    requests[1].respond(200, asyncResponse({ payload: { redirect: '/login', force: true } }));
    expect(goOrReplace).toHaveBeenCalledWith(window.location, href('/login'), true);
  });

  it('replaces the history entry of the page that redirects', async () => {
    const tick = () => new Promise(resolve => setTimeout(resolve, 0));
    Quickling.init(canvas, { version: 'v1' });

    PageTransitions.go('/old');
    await tick();
    expect(window.location.pathname).toBe('/old');
    const length = window.history.length;

    requests[0].respond(200, asyncResponse({ payload: { redirect: '/new' } }));
    await tick();

    expect(window.location.pathname).toBe('/new');
    expect(window.history.length).toBe(length);
  });

  it('loads in full the pages it must not handle', () => {
    Quickling.init(canvas, { inactivePageRegex: '^/admin', badRequestKeys: ['print'] });

    PageTransitions.go('/admin/users');
    PageTransitions.go('/feed?print=1');

    expect(requests).toHaveLength(0);
    expect(goOrReplace).toHaveBeenCalledWith(window.location, href('/admin/users'), false);
    expect(goOrReplace).toHaveBeenCalledWith(window.location, href('/feed?print=1'), false);
  });

  it('loads a page in full after the session length', () => {
    Quickling.init(canvas, { sessionLength: 2 });

    PageTransitions.go('/one');
    PageTransitions.go('/two');

    expect(requests).toHaveLength(1);
    expect(requests[0].aborted).toBe(true);
    expect(goOrReplace).toHaveBeenCalledWith(window.location, href('/two'), false);
  });

  it('only applies the response of the latest page transition', () => {
    Quickling.init(canvas, {});
    PageTransitions.go('/first');
    PageTransitions.go('/second');

    expect(requests[0].aborted).toBe(true);

    requests[1].respond(200, feedResponse({ version: undefined, title: 'Second' }));
    expect(document.title).toBe('Second');
  });

  it('drops the requests of the page it leaves', async () => {
    const { default: AsyncRequest } = await import('../async/AsyncRequest');
    const handler = vi.fn();
    new AsyncRequest('/home/more').setHandler(handler).send();
    Quickling.init(canvas, {});

    PageTransitions.go('/feed');

    expect(requests[0].aborted).toBe(true);
    expect(requests[1].aborted).toBe(false);
    requests[1].respond(200, feedResponse({ version: undefined }));
    expect(document.title).toBe('Feed');
    expect(handler).not.toHaveBeenCalled();
  });

  it('loads the page in full when the request fails', () => {
    Quickling.init(canvas, {});
    PageTransitions.go('/feed');

    requests[0].respond(500, '');

    expect(goOrReplace).toHaveBeenCalledWith(window.location, href('/feed'), true);
  });
});
