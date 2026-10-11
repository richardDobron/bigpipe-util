import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Arbiter from '../Arbiter';
import Dialog from '../Dialog';
import HideOnEscape from '../layer/HideOnEscape';
import Layer from '../layer/Layer';

let dialog;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<button id="opener">Open</button>';
  dialog = new Dialog();
});

afterEach(() => {
  dialog.close();
  vi.runAllTimers();
  vi.useRealTimers();
});

function open(model = {}) {
  const modal = dialog.showFromModel({
    title: 'Title',
    body: '<input id="name"><button id="ok" type="button">OK</button>',
    footer: '<button id="close" data-dismiss="modal">Close</button>',
    ...model
  });
  vi.runAllTimers();
  return modal;
}

function press(key, target = document.body) {
  const event = new KeyboardEvent('keydown', { key, which: key === 'Escape' ? 27 : 0, bubbles: true });
  target.dispatchEvent(event);
}

describe('events', () => {
  it('emits show, shown, hide and hidden with the modal, as before', () => {
    const events = [];
    const modal = dialog.showFromModel({
      body: 'Body',
      controller: m => ['show', 'shown', 'hide', 'hidden'].forEach(name => m.on(name, arg => events.push([name, arg === m])))
    });

    vi.runAllTimers();
    modal.hide();
    vi.runAllTimers();

    expect(events).toEqual([
      ['show', true],
      ['shown', true],
      ['hide', true],
      ['hidden', true]
    ]);
    expect(document.querySelector('.modal')).toBeNull();
  });

  it('emits dismiss and hides for data-dismiss, the backdrop and Escape', () => {
    const dismissed = vi.fn();
    const modal = open({ controller: m => m.on('dismiss', dismissed) });

    document.getElementById('close').click();
    expect(dismissed).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(modal.layer.isShown()).toBe(false);

    const second = open({ controller: m => m.on('dismiss', dismissed) });
    press('Escape');
    vi.runAllTimers();
    expect(dismissed).toHaveBeenCalledTimes(2);
    expect(second.layer.isShown()).toBe(false);
  });

  it('closes only the topmost dialog with Escape', () => {
    const lower = open();
    const upper = open();

    press('Escape');
    vi.runAllTimers();

    expect(upper.layer.isShown()).toBe(false);
    expect(lower.layer.isShown()).toBe(true);
  });

  it('gives Escape to a layer above the dialog first', () => {
    const modal = open();
    const menu = new Layer('<div><button id="item">Item</button></div>', {
      behaviors: [HideOnEscape],
      causalElement: document.getElementById('ok')
    });
    menu.show();
    vi.runAllTimers();

    press('Escape', document.getElementById('item'));
    vi.runAllTimers();
    expect(menu.isShown()).toBe(false);
    expect(modal.layer.isShown()).toBe(true);

    press('Escape');
    vi.runAllTimers();
    expect(modal.layer.isShown()).toBe(false);
    menu.destroy();
  });

  it('does not close with Escape when keyboard is false', () => {
    const modal = open({ keyboard: false });

    press('Escape');
    vi.runAllTimers();

    expect(modal.layer.isShown()).toBe(true);
  });

  it('tells apart dialogs with the same markup', () => {
    const model = { body: 'Same', transition: 300 };
    const lower = dialog.showFromModel(model);
    const upper = dialog.showFromModel(model);
    vi.advanceTimersByTime(0);
    expect(lower.el.isEqualNode(upper.el)).toBe(true);

    press('Escape');
    vi.runAllTimers();
    expect(upper.layer.isShown()).toBe(false);
    expect(lower.layer.isShown()).toBe(true);

    press('Escape');
    vi.runAllTimers();
    expect(lower.layer.isShown()).toBe(false);
  });

  it('closes dialogs with close() and closeCurrent()', () => {
    const lower = open();
    const upper = open();

    dialog.closeCurrent();
    vi.runAllTimers();
    expect(upper.layer.isShown()).toBe(false);

    dialog.close();
    vi.runAllTimers();
    expect(lower.layer.isShown()).toBe(false);
  });

  it('closes the last dialogs with close(limit), and none with close(0)', () => {
    const lower = open();
    const middle = open();
    const upper = open();

    dialog.close(0);
    vi.runAllTimers();
    expect([lower, middle, upper].map(m => m.layer.isShown())).toEqual([true, true, true]);

    dialog.close(2);
    vi.runAllTimers();
    expect([lower, middle, upper].map(m => m.layer.isShown())).toEqual([true, false, false]);

    dialog.close(5);
    vi.runAllTimers();
    expect(lower.layer.isShown()).toBe(false);
  });
});

describe('layer', () => {
  it('is available to controllers and follows the modal', () => {
    const states = [];
    const modal = dialog.showFromModel({
      body: 'Body',
      controller: m => {
        ['beforeshow', 'show', 'aftershow', 'beforehide', 'hide', 'destroy'].forEach(name =>
          m.layer.subscribe(name, () => states.push(name))
        );
      }
    });

    expect(modal.layer.isShown()).toBe(true);
    vi.runAllTimers();
    modal.hide();
    vi.runAllTimers();

    expect(states).toEqual(['beforeshow', 'show', 'aftershow', 'beforehide', 'hide', 'destroy']);
  });

  it('keeps the dialog open when beforehide returns false', () => {
    const modal = open({ controller: m => m.layer.subscribe('beforehide', () => false) });

    modal.hide();
    vi.runAllTimers();

    expect(modal.layer.isShown()).toBe(true);
    expect(document.querySelector('.modal')).not.toBeNull();
  });

  it('can be hidden before it is shown completely', () => {
    const modal = dialog.showFromModel({ body: 'Body', transition: 300 });

    modal.hide();
    vi.runAllTimers();

    expect(modal.layer.isShown()).toBe(false);
    expect(document.querySelector('.modal')).toBeNull();
  });

  it('ignores hide() when it is hidden already', () => {
    const hidden = vi.fn();
    const modal = open({ controller: m => m.on('hide', hidden) });

    modal.hide();
    modal.hide();
    vi.runAllTimers();

    expect(hidden).toHaveBeenCalledOnce();
  });
});

describe('focus', () => {
  it('moves the focus into the dialog and gives it back', () => {
    const opener = document.getElementById('opener');
    opener.focus();

    const modal = open();
    expect(document.getElementById('name')).toBe(document.activeElement);

    modal.hide();
    vi.runAllTimers();
    expect(document.activeElement).toBe(opener);
  });

  it('keeps Tab inside of the dialog', () => {
    open();
    vi.runAllTimers();

    const last = document.getElementById('close');
    last.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    last.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement.className).toBe('close');
  });

  it('can be turned off', () => {
    const opener = document.getElementById('opener');
    opener.focus();

    open({ autoFocus: false, refocus: false, trapFocus: false });

    expect(document.activeElement).toBe(opener);
  });
});

describe('hiding', () => {
  it('hides before a page transition unless turned off', () => {
    const first = open();
    new Arbiter().inform('pre_page_transition', { to: '/next' });
    vi.runAllTimers();
    expect(first.layer.isShown()).toBe(false);

    const second = open({ hideOnTransition: false });
    new Arbiter().inform('pre_page_transition', { to: '/next' });
    vi.runAllTimers();
    expect(second.layer.isShown()).toBe(true);
  });

  it('hides when a request relative to an element inside succeeds', () => {
    const modal = open({ hideOnSuccess: true });

    document.getElementById('ok').dispatchEvent(new CustomEvent('success', { bubbles: true }));
    vi.runAllTimers();

    expect(modal.layer.isShown()).toBe(false);
  });

  it('hides on success only for the matching elements', () => {
    const modal = open({ hideOnSuccess: '#name' });

    document.getElementById('ok').dispatchEvent(new CustomEvent('success', { bubbles: true }));
    vi.runAllTimers();
    expect(modal.layer.isShown()).toBe(true);

    document.getElementById('name').dispatchEvent(new CustomEvent('success', { bubbles: true }));
    vi.runAllTimers();
    expect(modal.layer.isShown()).toBe(false);
  });

  it('does not hide on success by default', () => {
    const modal = open();

    document.getElementById('ok').dispatchEvent(new CustomEvent('success', { bubbles: true }));
    vi.runAllTimers();

    expect(modal.layer.isShown()).toBe(true);
  });
});

describe('position', () => {
  it('sets the top margin of the dialog', async () => {
    window.innerHeight = 900;
    const modal = open({ position: true });
    await Promise.resolve();

    expect(modal.el.firstElementChild.style.marginTop).toBe('300px');
  });

  it('accepts a fixed top and a centered dialog', async () => {
    window.innerHeight = 900;
    const fixed = open({ position: { top: 80 } });
    const centered = open({ position: { centered: true } });
    await Promise.resolve();

    expect(fixed.el.firstElementChild.style.marginTop).toBe('80px');
    expect(centered.el.firstElementChild.style.marginTop).toBe('450px');
  });

  it('is left to your CSS by default', () => {
    expect(open().el.firstElementChild.style.marginTop).toBe('');
  });
});
