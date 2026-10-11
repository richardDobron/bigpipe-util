import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PageTransitions from '../../PageTransitions';
import Arbiter from '../Arbiter';
import FormMonitor from '../FormMonitor';

vi.mock('../goOrReplace', () => ({ default: vi.fn() }));

let form;
let monitor;
let name;

beforeEach(() => {
  document.body.innerHTML = `
    <form id="form" action="/save" method="POST">
      <input name="title" value="Hello">
      <input type="checkbox" name="draft" value="1">
      <select name="kind"><option value="a" selected>A</option><option value="b">B</option></select>
      <textarea name="body">Text</textarea>
    </form>`;
  form = document.getElementById('form');
  name = form.elements.title;
});

afterEach(() => {
  monitor.destroy();
  vi.restoreAllMocks();
});

function type(value) {
  name.value = value;
  name.dispatchEvent(new Event('input', { bubbles: true }));
}

function beforeUnload() {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe('FormMonitor', () => {
  it('is clean until a value changes and clean again when it changes back', () => {
    monitor = new FormMonitor(form);
    const events = [];
    ['change', 'dirty', 'clean'].forEach(event =>
      monitor.subscribe(event, () => events.push(event))
    );

    expect(monitor.isDirty()).toBe(false);

    type('Hello world');
    expect(monitor.isDirty()).toBe(true);

    type('Hello world!');
    type('Hello');
    expect(monitor.isDirty()).toBe(false);
    expect(events).toEqual(['change', 'dirty', 'change', 'change', 'clean']);
  });

  it.each([
    ['a checkbox', () => (form.elements.draft.checked = true), 'change'],
    ['a select', () => (form.elements.kind.value = 'b'), 'change'],
    ['a textarea', () => (form.elements.body.value = 'Other'), 'input']
  ])('notices a change of %s', (title, change, type) => {
    monitor = new FormMonitor(form);

    change();
    form.dispatchEvent(new Event(type, { bubbles: true }));

    expect(monitor.isDirty()).toBe(true);
  });

  it('notices a form reset', () => {
    vi.useFakeTimers();
    monitor = new FormMonitor(form);
    type('Other');

    form.reset();
    vi.runAllTimers();

    expect(monitor.isDirty()).toBe(false);
    vi.useRealTimers();
  });

  it('stops notifying after remove()', () => {
    monitor = new FormMonitor(form);
    const dirty = vi.fn();
    monitor.subscribe('dirty', dirty).remove();

    type('Other');

    expect(dirty).not.toHaveBeenCalled();
  });

  it('keeps the current values as clean after reset()', () => {
    monitor = new FormMonitor(form);
    type('Saved');

    monitor.reset();

    expect(monitor.isDirty()).toBe(false);
    type('Changed');
    expect(monitor.isDirty()).toBe(true);
  });
});

describe('leaving the page', () => {
  it('asks the browser before the page is closed while the form is dirty', () => {
    monitor = new FormMonitor(form);

    expect(beforeUnload().defaultPrevented).toBe(false);

    type('Other');
    expect(beforeUnload().defaultPrevented).toBe(true);
  });

  it('asks with the message before a page transition', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const handler = vi.fn(() => true);
    PageTransitions.registerHandler(handler);
    PageTransitions.init();
    monitor = new FormMonitor(form, { message: form_ => `Save ${form_.id}?` });
    type('Other');

    PageTransitions.go('/next');

    expect(confirm).toHaveBeenCalledWith('Save form?');
    expect(handler).not.toHaveBeenCalled();
    PageTransitions.removeHandler(handler);
  });

  it('does not ask when the form is clean, warn is off or it is destroyed', () => {
    monitor = new FormMonitor(form, { warn: false });
    type('Other');
    expect(beforeUnload().defaultPrevented).toBe(false);
    monitor.destroy();

    monitor = new FormMonitor(form);
    type('Another');
    monitor.destroy();
    expect(beforeUnload().defaultPrevented).toBe(false);
  });

  it('is destroyed with the pagelet that holds the form', () => {
    monitor = new FormMonitor(form);
    type('Other');

    new Arbiter().inform('Pagelet/destroy', { id: null, root: document.body });

    expect(beforeUnload().defaultPrevented).toBe(false);
  });
});

describe('saving', () => {
  it('becomes clean when a request of an async form succeeds', () => {
    form.setAttribute('rel', 'async');
    monitor = new FormMonitor(form);
    type('Other');

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(monitor.isDirty()).toBe(true);

    form.dispatchEvent(new CustomEvent('success', { bubbles: true }));
    expect(monitor.isDirty()).toBe(false);
  });

  it('ignores the success of an element inside of the form', () => {
    form.setAttribute('rel', 'async');
    monitor = new FormMonitor(form);
    type('Other');

    name.dispatchEvent(new CustomEvent('success', { bubbles: true }));

    expect(monitor.isDirty()).toBe(true);
  });

  it('becomes clean on a submit that leaves the page, so it does not ask', async () => {
    monitor = new FormMonitor(form);
    type('Other');

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();

    expect(monitor.isDirty()).toBe(false);
    expect(beforeUnload().defaultPrevented).toBe(false);
  });

  it('stays dirty when another handler cancels the submit', async () => {
    monitor = new FormMonitor(form);
    type('Other');

    form.addEventListener('submit', event => event.preventDefault());
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();

    expect(monitor.isDirty()).toBe(true);
  });
});
