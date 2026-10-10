import { beforeEach, describe, expect, it, vi } from 'vitest';

let KeyEventController;
let Arbiter;

beforeEach(async () => {
  vi.resetModules();
  ({ default: KeyEventController } = await import('../KeyEventController'));
  ({ default: Arbiter } = await import('../Arbiter'));
  document.body.innerHTML = '<input id="search" value=""><div id="feed"></div>';
});

function press(key, init = {}, target = document.getElementById('feed')) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('KeyEventController', () => {
  it('calls the shortcut of a key, and stops at a callback that returns false', () => {
    const next = vi.fn(() => false);
    const other = vi.fn();
    KeyEventController.registerKey('j', next);
    KeyEventController.registerKey('J', other);

    const event = press('j');

    expect(next).toHaveBeenCalledWith(event, 'onkeydown');
    expect(other).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('ignores typing, modifiers and repeats by default', () => {
    const search = vi.fn();
    const close = vi.fn();
    KeyEventController.registerKey('SLASH', search);
    KeyEventController.registerKey('ESCAPE', close);
    const input = document.getElementById('search');

    press('/', {}, input);
    press('/', { ctrlKey: true });
    press('/', { repeat: true });
    expect(search).not.toHaveBeenCalled();

    press('Escape', {}, input);
    expect(close).toHaveBeenCalledOnce();

    input.value = 'pipes';
    press('Escape', {}, input);
    expect(close).toHaveBeenCalledOnce();
  });

  it('removes a shortcut, or replaces the other shortcuts of a key', () => {
    const first = vi.fn();
    const second = vi.fn();
    const subscription = KeyEventController.registerKey('k', first);

    subscription.remove();
    press('k');
    expect(first).not.toHaveBeenCalled();

    KeyEventController.registerKey('k', first);
    KeyEventController.registerKey('k', second, undefined, true);
    press('k');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it('removes the shortcuts of the page on a page transition, but not the ones across transitions', () => {
    const page = vi.fn();
    const across = vi.fn();
    KeyEventController.registerKey('n', page);
    KeyEventController.registerKeyAcrossTransitions('n', across);

    new Arbiter().inform('page_transition', {});
    press('n');

    expect(page).not.toHaveBeenCalled();
    expect(across).toHaveBeenCalledOnce();
  });
});
