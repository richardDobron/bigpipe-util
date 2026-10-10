import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TimerStorage from '../TimerStorage';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  TimerStorage.clearAll();
  vi.useRealTimers();
});

describe('TimerStorage', () => {
  it('clears the timers of the page, but not the ones across transitions', () => {
    const page = vi.fn();
    const across = vi.fn();

    TimerStorage.setTimeout(page, 10);
    TimerStorage.setInterval(page, 10);
    TimerStorage.requestIdleCallback(page);
    TimerStorage.setTimeoutAcrossTransitions(across, 10);
    TimerStorage.setIntervalAcrossTransitions(across, 10);

    TimerStorage.clearAll();
    vi.advanceTimersByTime(25);

    expect(page).not.toHaveBeenCalled();
    expect(across).toHaveBeenCalledTimes(3);
  });

  it('runs a timeout with its arguments and can clear it', () => {
    const callback = vi.fn();

    TimerStorage.setTimeout(callback, 10, 'a', 'b');
    const cleared = TimerStorage.setTimeout(callback, 10);
    TimerStorage.clearTimeout(cleared);
    vi.advanceTimersByTime(10);

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith('a', 'b');
  });
});
