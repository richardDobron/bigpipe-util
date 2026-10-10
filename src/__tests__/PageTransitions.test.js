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

describe('PageTransitions', () => {
  it('loads a same-origin link with a handler and adds it to the history', () => {
    const informed = vi.fn();
    const subscription = new Arbiter().subscribe('page_transition', informed);

    const event = click('<a href="/feed?page=2">Feed</a>');

    expect(event.defaultPrevented).toBe(true);
    expect(handler.mock.calls[0][0].href).toBe(window.location.origin + '/feed?page=2');
    expect(window.location.pathname + window.location.search).toBe('/feed?page=2');
    expect(window.history.state).toEqual({ uri: '/feed?page=2' });
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

  it('loads the page of the back button and restores its scroll position', () => {
    PageTransitions.go('/first');
    PageTransitions.transitionComplete();
    window.scrollX = 0;
    window.scrollY = 420;
    window.dispatchEvent(new Event('scroll'));
    PageTransitions.go('/second');
    PageTransitions.transitionComplete();
    handler.mockClear();
    vi.mocked(window.scrollTo).mockClear();

    window.dispatchEvent(new PopStateEvent('popstate', { state: { uri: '/first' } }));
    PageTransitions.transitionComplete();

    expect(handler.mock.calls[0][0].pathname).toBe('/first');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 420);
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

  it('runs the leave hooks once', () => {
    const hook = vi.fn();
    PageTransitions.addLeaveHook(hook);

    PageTransitions.runLeaveHooks();
    PageTransitions.runLeaveHooks();

    expect(hook).toHaveBeenCalledOnce();
  });
});
