import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PageTransitions from '../../PageTransitions';
import Arbiter from '../Arbiter';
import Run from '../Run';

vi.mock('../goOrReplace', () => ({ default: vi.fn() }));

beforeEach(() => {
  window.scrollTo = vi.fn();
  document.body.innerHTML = '';
});

afterEach(() => {
  PageTransitions.runLeaveHooks();
  window.dispatchEvent(new Event('pagehide'));
  vi.restoreAllMocks();
});

describe('Run.onLoad', () => {
  it('calls back right away once the DOM is ready', () => {
    const callback = vi.fn();

    Run.onLoad(callback);

    expect(callback).toHaveBeenCalledOnce();
  });
});

describe('Run.onAfterLoad', () => {
  it('calls back after the page has loaded', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    Run.onAfterLoad(callback);
    vi.runAllTimers();

    expect(callback).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('does not call back after remove()', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    Run.onAfterLoad(callback).remove();
    vi.runAllTimers();

    expect(callback).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('Run.onLeave', () => {
  it('runs once when the page is left with a page transition', () => {
    const callback = vi.fn();
    Run.onLeave(callback);

    PageTransitions.runLeaveHooks();
    window.dispatchEvent(new Event('pagehide'));
    PageTransitions.runLeaveHooks();

    expect(callback).toHaveBeenCalledOnce();
  });

  it('runs once when the page is closed', () => {
    const callback = vi.fn();
    Run.onLeave(callback);

    window.dispatchEvent(new Event('pagehide'));
    PageTransitions.runLeaveHooks();
    window.dispatchEvent(new Event('pagehide'));

    expect(callback).toHaveBeenCalledOnce();
  });

  it('does not run after remove()', () => {
    const callback = vi.fn();
    Run.onLeave(callback).remove();

    PageTransitions.runLeaveHooks();
    window.dispatchEvent(new Event('pagehide'));

    expect(callback).not.toHaveBeenCalled();
  });
});

describe('Run.onUnload', () => {
  it('runs when the page is closed but not on a page transition', () => {
    const callback = vi.fn();
    Run.onUnload(callback);

    PageTransitions.runLeaveHooks();
    expect(callback).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('pagehide'));
    expect(callback).toHaveBeenCalledOnce();
  });

  it('does not run when the page is kept in the back/forward cache', () => {
    const unload = vi.fn();
    const leave = vi.fn();
    Run.onUnload(unload);
    Run.onLeave(leave);

    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expect(unload).not.toHaveBeenCalled();
    expect(leave).not.toHaveBeenCalled();

    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
    expect(unload).toHaveBeenCalledOnce();
    expect(leave).toHaveBeenCalledOnce();
  });
});

describe('Run.onBeforeUnload', () => {
  it('asks the browser before the page is closed', () => {
    const subscription = Run.onBeforeUnload(() => 'You have unsaved changes.');
    const event = new Event('beforeunload', { cancelable: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    subscription.remove();
  });

  it('lets the page go without a message', () => {
    const subscription = Run.onBeforeUnload(() => null);
    const event = new Event('beforeunload', { cancelable: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    subscription.remove();
  });

  it('is a hook that asks before a page transition', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const handler = vi.fn(() => true);
    PageTransitions.registerHandler(handler);
    PageTransitions.init();
    const subscription = Run.onBeforeUnload(() => 'You have unsaved changes.');

    PageTransitions.go('/next');

    expect(confirm).toHaveBeenCalledWith('You have unsaved changes.');
    expect(handler).not.toHaveBeenCalled();

    subscription.remove();
    PageTransitions.removeHandler(handler);
  });

  it('does not ask again in the full page load that follows a confirmed transition', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    PageTransitions.init();
    const subscription = Run.onBeforeUnload(() => 'You have unsaved changes.');

    PageTransitions.go('/next');
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(PageTransitions.isLeaveConfirmed()).toBe(true);
    expect(event.defaultPrevented).toBe(false);
    subscription.remove();
  });

  it('asks again when the page comes back from the back/forward cache', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    PageTransitions.init();
    const subscription = Run.onBeforeUnload(() => 'You have unsaved changes.');

    PageTransitions.go('/next');
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(PageTransitions.isLeaveConfirmed()).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    subscription.remove();
  });

  it('does not run the hook after remove()', () => {
    const hook = vi.fn();
    Run.onBeforeUnload(hook).remove();

    window.dispatchEvent(new Event('beforeunload', { cancelable: true }));

    expect(hook).not.toHaveBeenCalled();
  });
});

describe('Run.onCleanupOrLeave', () => {
  it('runs when the pagelet of the element is destroyed', () => {
    document.body.innerHTML = '<div id="pagelet_feed"><span id="time"></span></div>';
    const callback = vi.fn();
    Run.onCleanupOrLeave(document.getElementById('time'), callback);

    new Arbiter().inform('pagelet/destroy', { id: 'other', root: document.createElement('div') });
    expect(callback).not.toHaveBeenCalled();

    new Arbiter().inform('pagelet/destroy', {
      id: 'feed',
      root: document.getElementById('pagelet_feed')
    });
    PageTransitions.runLeaveHooks();

    expect(callback).toHaveBeenCalledOnce();
  });

  it('runs when the page is left', () => {
    const callback = vi.fn();
    Run.onCleanupOrLeave(document.body, callback);

    PageTransitions.runLeaveHooks();

    expect(callback).toHaveBeenCalledOnce();
  });

  it('does not run after remove()', () => {
    const callback = vi.fn();
    Run.onCleanupOrLeave(document.body, callback).remove();

    new Arbiter().inform('pagelet/destroy', { id: null, root: document.body });
    PageTransitions.runLeaveHooks();

    expect(callback).not.toHaveBeenCalled();
  });
});
