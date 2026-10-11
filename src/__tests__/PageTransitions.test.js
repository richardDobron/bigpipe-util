import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import PageTransitions, { DELAY_HISTORY } from '../PageTransitions';
import Arbiter from '../core/Arbiter';
import goOrReplace from '../core/goOrReplace';

vi.mock('../core/goOrReplace', () => ({ default: vi.fn() }));

let handler;

beforeAll(() => {
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  window.history.replaceState(null, '', '/start');
  PageTransitions.init();
});

beforeEach(() => {
  handler = vi.fn(() => true);
  PageTransitions.registerHandler(handler);
  document.body.innerHTML = '';
  vi.mocked(goOrReplace).mockClear();
});

afterEach(() => {
  PageTransitions.removeHandler(handler);
  PageTransitions.transitionComplete(true);
});

function click(html, init = {}) {
  document.body.innerHTML = html;
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  document.body.firstChild.dispatchEvent(event);
  return event;
}

function scroll(y) {
  window.scrollX = 0;
  window.scrollY = y;
  window.dispatchEvent(new Event('scroll'));
}

// Goes back or forward in the history and waits for its popstate, or for as many as it causes.
function traverse(delta, popStates = 1) {
  return new Promise(resolve => {
    let count = 0;
    const listener = () => {
      count += 1;
      if (count === popStates) {
        window.removeEventListener('popstate', listener);
        resolve();
      }
    };
    window.addEventListener('popstate', listener);
    window.history.go(delta);
  });
}

describe('PageTransitions', () => {
  it('loads a same-origin link with a handler and adds it to the history', () => {
    const informed = vi.fn();
    const subscription = new Arbiter().subscribe('page_transition', informed);

    const event = click('<a href="/feed?page=2">Feed</a>');

    expect(event.defaultPrevented).toBe(true);
    expect(handler.mock.calls[0][0].href).toBe(window.location.origin + '/feed?page=2');
    expect(window.location.pathname + window.location.search).toBe('/feed?page=2');
    expect(window.history.state).toEqual({ uri: '/feed?page=2', index: 1, id: expect.any(String) });
    expect(informed).toHaveBeenCalledOnce();
    subscription.remove();
  });

  it.each([
    ['another origin', '<a href="https://example.org/">x</a>', {}],
    ['a new window', '<a href="/a" target="_blank">x</a>', {}],
    ['a download', '<a href="/a.pdf" download>x</a>', {}],
    ['an async link', '<a href="#" rel="async" ajaxify="/a">x</a>', {}],
    ['an external link', '<a href="/a" rel="external">x</a>', {}],
    ['a modifier key', '<a href="/a">x</a>', { ctrlKey: true }],
    ['the middle button', '<a href="/a">x</a>', { button: 1 }]
  ])('leaves %s to the browser', (name, html, init) => {
    const event = click(html, init);

    expect(event.defaultPrevented).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('loads the page in full when no handler loads it, and drops that handler', () => {
    const declining = vi.fn(() => false);
    PageTransitions.registerHandler(declining, 2);

    PageTransitions.go('/settings');
    PageTransitions.go('/settings');

    expect(declining).toHaveBeenCalledOnce();
    expect(goOrReplace).not.toHaveBeenCalled();

    PageTransitions.removeHandler(handler);
    PageTransitions.go('/help', true);
    expect(goOrReplace).toHaveBeenCalledWith(
      window.location,
      window.location.origin + '/help',
      true
    );
  });

  it('adds the history entry later for a handler that delays it', async () => {
    const delaying = () => DELAY_HISTORY;
    PageTransitions.registerHandler(delaying, 3);
    const before = window.location.pathname;

    PageTransitions.go('/later');
    expect(window.location.pathname).toBe(before);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(window.location.pathname).toBe('/later');
    PageTransitions.removeHandler(delaying, 3);
  });

  it('replaces the history entry with go(uri, true)', () => {
    PageTransitions.go('/list');
    const length = window.history.length;
    const { index } = window.history.state;

    PageTransitions.go('/list?sort=new', true);

    expect(window.location.pathname + window.location.search).toBe('/list?sort=new');
    expect(window.history.length).toBe(length);
    expect(window.history.state).toEqual({ uri: '/list?sort=new', index, id: expect.any(String) });
  });

  it('lets a page replace the entry of a delaying handler before it is added', async () => {
    const delaying = () => DELAY_HISTORY;
    PageTransitions.registerHandler(delaying, 3);
    const length = window.history.length;

    PageTransitions.go('/old');
    PageTransitions.go('/new', true);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(window.location.pathname).toBe('/new');
    expect(window.history.length).toBe(length + 1);

    PageTransitions.go('/newer', true);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(window.location.pathname).toBe('/newer');
    expect(window.history.length).toBe(length + 1);
    PageTransitions.removeHandler(delaying, 3);
  });

  it('submits a GET form as a page transition', () => {
    document.body.innerHTML =
      '<form action="/search"><input name="q" value="pipes"><button name="sort" value="new">Go</button></form>';
    const form = document.querySelector('form');
    const event = new SubmitEvent('submit', {
      bubbles: true,
      cancelable: true,
      submitter: form.querySelector('button')
    });

    form.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(handler.mock.calls[0][0].href).toBe(window.location.origin + '/search?q=pipes&sort=new');
  });

  it('only scrolls for a link to a fragment of the page', () => {
    PageTransitions.go('/article');
    handler.mockClear();
    document.body.innerHTML = '<h2 id="comments">Comments</h2>';

    PageTransitions.go('/article#comments');

    expect(handler).not.toHaveBeenCalled();
    expect(document.getElementById('comments').scrollIntoView).toHaveBeenCalled();
    expect(window.location.hash).toBe('#comments');
  });

  it.each(['#', '/article#'])('does nothing for a link to %s on the page', href => {
    PageTransitions.go('/article');
    handler.mockClear();
    const length = window.history.length;

    const event = click(`<a href="${href}">Menu</a>`);

    expect(event.defaultPrevented).toBe(true);
    expect(handler).not.toHaveBeenCalled();
    expect(goOrReplace).not.toHaveBeenCalled();
    expect(window.history.length).toBe(length);
    expect(window.location.href).toBe(window.location.origin + '/article');
  });

  it('loads another page linked with an empty fragment', () => {
    PageTransitions.go('/article');
    handler.mockClear();

    click('<a href="/feed#">Feed</a>');

    expect(handler.mock.calls[0][0].pathname).toBe('/feed');
  });

  it('loads the page of the back button and restores its scroll position', async () => {
    PageTransitions.go('/first');
    PageTransitions.transitionComplete();
    scroll(420);
    PageTransitions.go('/second');
    PageTransitions.transitionComplete();
    handler.mockClear();
    vi.mocked(window.scrollTo).mockClear();

    await traverse(-1);
    PageTransitions.transitionComplete();

    expect(handler.mock.calls[0][0].pathname).toBe('/first');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 420);
  });

  it('keeps a scroll position for every history entry, also of the same URL', async () => {
    PageTransitions.go('/same');
    PageTransitions.transitionComplete();
    scroll(100);
    PageTransitions.go('/same');
    PageTransitions.transitionComplete();
    scroll(300);
    vi.mocked(window.scrollTo).mockClear();

    await traverse(-1);

    expect(window.scrollTo).toHaveBeenCalledWith(0, 100);
    expect(window.scrollTo).not.toHaveBeenCalledWith(0, 300);
  });

  it('keeps the scroll position in the state of the history entry', async () => {
    PageTransitions.go('/kept');
    PageTransitions.transitionComplete();
    scroll(250);
    PageTransitions.go('/next');
    PageTransitions.transitionComplete();
    scroll(80);

    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
    expect(window.history.state.scroll).toEqual({ x: 0, y: 80 });

    await traverse(-1);
    expect(window.history.state.scroll).toEqual({ x: 0, y: 250 });
  });

  it('asks before leaving a page with a before leave hook', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const hook = PageTransitions.addBeforeLeaveHook(() => 'You have unsaved changes.');

    PageTransitions.go('/away');

    expect(confirm).toHaveBeenCalledWith('You have unsaved changes.');
    expect(handler).not.toHaveBeenCalled();
    hook.remove();
    confirm.mockRestore();
  });

  it('goes back to the entry of the page and keeps the next ones when the user stays', async () => {
    PageTransitions.go('/one');
    PageTransitions.go('/two');
    PageTransitions.go('/three');
    await traverse(-1);
    const length = window.history.length;
    handler.mockClear();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const hook = PageTransitions.addBeforeLeaveHook(() => 'You have unsaved changes.');

    await traverse(-1, 2);

    expect(confirm).toHaveBeenCalledOnce();
    expect(handler).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/two');
    expect(window.history.length).toBe(length);

    hook.remove();
    confirm.mockRestore();
    await traverse(1);
    expect(handler.mock.calls[0][0].pathname).toBe('/three');
  });

  it('runs the leave hooks once', () => {
    const hook = vi.fn();
    PageTransitions.addLeaveHook(hook);

    PageTransitions.runLeaveHooks();
    PageTransitions.runLeaveHooks();

    expect(hook).toHaveBeenCalledOnce();
  });

  it('loads the page of an entry another script added', async () => {
    PageTransitions.go('/tabs');
    window.history.pushState({ tab: 2 }, '', '/tabs?tab=2');
    window.history.pushState(null, '', '/tabs?tab=3');
    handler.mockClear();

    await traverse(-1);

    expect(handler.mock.calls[0][0].search).toBe('?tab=2');
    expect(PageTransitions.getCurrentURI().search).toBe('?tab=2');
  });

  it('only scrolls for an entry of another fragment of the page', async () => {
    PageTransitions.go('/doc');
    window.history.pushState(null, '', '/doc#reviews');
    window.history.pushState(null, '', '/doc#specs');
    document.body.innerHTML = '<h2 id="reviews">Reviews</h2>';
    handler.mockClear();

    await traverse(-1);

    expect(handler).not.toHaveBeenCalled();
    expect(goOrReplace).not.toHaveBeenCalled();
    expect(document.getElementById('reviews').scrollIntoView).toHaveBeenCalled();
    expect(PageTransitions.getCurrentURI().hash).toBe('#reviews');
  });
});

describe('PageTransitions of a page loaded in full again', () => {
  it('restores the scroll position of its history entry once the page has loaded', async () => {
    window.history.replaceState(
      { uri: '/reloaded', index: 3, id: 'entry', scroll: { x: 0, y: 640 } },
      '',
      '/reloaded'
    );
    vi.mocked(window.scrollTo).mockClear();
    vi.resetModules();
    const { default: ReloadedPageTransitions } = await import('../PageTransitions');

    ReloadedPageTransitions.init();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(window.scrollTo).toHaveBeenCalledWith(0, 640);
    expect(window.history.state).toEqual({ uri: '/reloaded', index: 3, id: 'entry' });
  });
});
