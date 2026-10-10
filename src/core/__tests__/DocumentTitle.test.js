import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let DocumentTitle;
let Arbiter;

beforeEach(async () => {
  vi.resetModules();
  document.title = 'Feed';
  ({ default: DocumentTitle } = await import('../DocumentTitle'));
  ({ default: Arbiter } = await import('../Arbiter'));
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DocumentTitle', () => {
  it('sets the title and informs update_title', () => {
    const updated = vi.fn();
    new Arbiter().subscribe('update_title', updated);

    DocumentTitle.set('Messages');

    expect(document.title).toBe('Messages');
    expect(DocumentTitle.get()).toBe('Messages');
    expect(updated).toHaveBeenCalledWith('Messages');
  });

  it('keeps the true title for a temporary one', () => {
    DocumentTitle.set('(2) Feed', true);

    expect(document.title).toBe('(2) Feed');
    expect(DocumentTitle.get()).toBe('Feed');
  });

  it('blinks titles until they are stopped', () => {
    const message = DocumentTitle.blink('New message');
    const call = DocumentTitle.blink('Incoming call');

    vi.advanceTimersByTime(1500);
    expect(document.title).toBe('New message');
    vi.advanceTimersByTime(1500);
    expect(document.title).toBe('Feed');
    vi.advanceTimersByTime(1500);
    expect(document.title).toBe('Incoming call');

    message.stop();
    call.stop();
    vi.advanceTimersByTime(3000);
    expect(document.title).toBe('Feed');
    expect(vi.getTimerCount()).toBe(0);
  });
});
