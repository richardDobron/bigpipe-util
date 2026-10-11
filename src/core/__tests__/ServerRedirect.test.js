import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../goOrReplace', () => ({ default: vi.fn() }));
vi.mock('../../PageTransitions', () => ({ default: { go: vi.fn() } }));

let ServerRedirect;
let goOrReplace;
let PageTransitions;
let TimerStorage;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  ({ default: ServerRedirect } = await import('../ServerRedirect'));
  ({ default: goOrReplace } = await import('../goOrReplace'));
  ({ default: PageTransitions } = await import('../../PageTransitions'));
  TimerStorage = await import('../TimerStorage');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ServerRedirect', () => {
  it('loads the URL in full after the delay', () => {
    new ServerRedirect().redirectPageTo('/login', 500);
    vi.advanceTimersByTime(499);
    expect(goOrReplace).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(goOrReplace).toHaveBeenCalledWith(window.location, '/login', false);
    expect(PageTransitions.go).not.toHaveBeenCalled();
  });

  it('replaces the history entry, or loads the URL with a page transition', () => {
    new ServerRedirect().redirectPageTo('/login', 0, true);
    new ServerRedirect().redirectPageTo('/feed', 0, true, true);
    vi.runAllTimers();

    expect(goOrReplace).toHaveBeenCalledWith(window.location, '/login', true);
    expect(PageTransitions.go).toHaveBeenCalledWith('/feed', true);
  });

  it('does not redirect once the page was left', () => {
    new ServerRedirect().redirectPageTo('/login', 1000);
    TimerStorage.clearAll();
    vi.runAllTimers();

    expect(goOrReplace).not.toHaveBeenCalled();
  });
});
