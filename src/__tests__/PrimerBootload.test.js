import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeXHR } from '../__testutils__/fakeXHR';

const SCRIPT = '/static/async-request.js';

let requests;
let listeners;

// The Bootloader keeps what it loaded: every test gets fresh modules.
beforeEach(async () => {
  vi.resetModules();
  const { default: Bootloader } = await import('../Bootloader');
  const { default: AsyncRequest } = await import('../async/AsyncRequest');
  const { registerModules } = await import('../core/requireModule');
  const { default: Primer } = await import('../Primer');

  requests = installFakeXHR();
  document.head.innerHTML = '';
  document.body.innerHTML = `
    <a id="get" href="/real" ajaxify="/ajax/remove.php" rel="async">Remove</a>
    <form action="/ajax/subscribe.php" method="POST" rel="async">
      <input name="email" value="jo@example.com">
      <button type="submit">Subscribe</button>
    </form>`;

  Bootloader.enableBootload({ 'bigpipe-util/dist/async/AsyncRequest': [SCRIPT] });
  listeners = [];
  const add = document.documentElement.addEventListener;
  vi.spyOn(document.documentElement, 'addEventListener').mockImplementation((...args) => {
    listeners.push(args);
    add.apply(document.documentElement, args);
  });
  Primer();
  window.loadAsyncRequest = () => {
    registerModules({ 'bigpipe-util/dist/async/AsyncRequest': AsyncRequest });
    document.querySelector(`script[src="${SCRIPT}"]`).onload();
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  listeners.forEach(args => document.documentElement.removeEventListener(...args));
});

function click(element) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

function submit(form) {
  const event = new SubmitEvent('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(event);
  return event;
}

describe('Primer with AsyncRequest loaded on demand', () => {
  it('cancels the click and sends the request once the module is loaded', () => {
    const link = document.getElementById('get');

    const event = click(link);
    click(link);

    expect(event.defaultPrevented).toBe(true);
    expect(requests).toHaveLength(0);

    window.loadAsyncRequest();

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toContain('/ajax/remove.php');
  });

  it('keeps the data of a submit and ignores a second submit while loading', () => {
    const form = document.querySelector('form');

    submit(form);
    form.querySelector('input').value = 'changed@example.com';
    submit(form);
    window.loadAsyncRequest();

    expect(requests).toHaveLength(1);
    expect(requests[0].body.get('email')).toBe('jo@example.com');
  });

  it('allows another click when the module failed to load', () => {
    vi.useFakeTimers();
    const link = document.getElementById('get');
    click(link);

    // The script fails on every attempt.
    document.querySelector(`script[src="${SCRIPT}"]`).onerror();
    vi.advanceTimersByTime(500);
    document.querySelector(`script[src="${SCRIPT}"]`).onerror();
    vi.advanceTimersByTime(2000);
    document.querySelector(`script[src="${SCRIPT}"]`).onerror();
    expect(requests).toHaveLength(0);
    expect(() => vi.runAllTimers()).toThrow(/AsyncRequest/);

    expect(click(link).defaultPrevented).toBe(true);
    vi.useRealTimers();
  });
});
