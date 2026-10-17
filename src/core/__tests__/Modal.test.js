import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Dialog from '../Dialog';
import Modal from '../Modal';
import Layer from '../layer/Layer';
import ModalLayer from '../layer/ModalLayer';

let modals;

beforeEach(() => {
  vi.useFakeTimers();
  modals = [];
  document.body.innerHTML = '';
  document.body.className = '';
  document.body.style.overflow = '';
});

afterEach(() => {
  modals.forEach(modal => modal.hide());
  vi.runAllTimers();
  vi.useRealTimers();
  Modal.templates = undefined;
  Modal.selectors = undefined;
  Modal.options = undefined;
});

function create(options = {}) {
  const modal = new Modal({ transition: 0, backdropTransition: 0, ...options });
  modals.push(modal);
  return modal;
}

function show(options) {
  const modal = create(options).show();
  vi.runAllTimers();
  return modal;
}

function click(target) {
  ['mousedown', 'mouseup', 'click'].forEach(type =>
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }))
  );
}

function press(key) {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('markup', () => {
  it('builds a Bootstrap-compatible modal by default', () => {
    const modal = show({ title: 'Title', content: '<p>Body</p>', footer: '<button>OK</button>' });

    expect(modal.el.className).toBe('modal fade show');
    expect(
      modal.el.querySelector('.modal-dialog > .modal-content > .modal-header .modal-title')
        .textContent
    ).toBe('Title');
    expect(modal.el.querySelector('.modal-body').innerHTML).toBe('<p>Body</p>');
    expect(modal.el.querySelector('.modal-footer').innerHTML).toBe('<button>OK</button>');
    expect(modal.backdrop.className).toBe('modal-backdrop fade show');
    expect(document.body.classList.contains('modal-open')).toBe(true);
  });

  it('is labelled by its title, or by the label option', () => {
    const titled = create({ title: 'Settings' });
    const title = titled.el.querySelector('.modal-title');
    expect(titled.el.getAttribute('role')).toBe('dialog');
    expect(titled.el.getAttribute('aria-modal')).toBe('true');
    expect(titled.el.getAttribute('aria-labelledby')).toBe(title.id);

    const labelled = create({ label: 'Photo viewer' });
    expect(labelled.el.querySelector('.modal-title')).toBeNull();
    expect(labelled.el.getAttribute('aria-label')).toBe('Photo viewer');
  });

  it('takes elements as content and keeps them as they are', () => {
    const button = document.createElement('button');
    const clicked = vi.fn();
    button.addEventListener('click', clicked);

    show({ content: button });
    button.click();

    expect(clicked).toHaveBeenCalledOnce();
  });

  it('can use your own templates and class names, e.g. for Tailwind', () => {
    Modal.templates = {
      container: '<div class="fixed inset-0 flex items-center justify-center"></div>',
      dialog: '<div class="w-full max-w-lg"></div>',
      content: '<div class="rounded-lg bg-white shadow-xl"></div>',
      backdrop: '<div class="fixed inset-0 bg-black/50"></div>'
    };
    const modal = show({
      content: 'Body',
      animateClass: 'opacity-0 transition-opacity',
      animateInClass: 'opacity-100',
      openClass: 'overflow-hidden'
    });

    expect(modal.el.className).toBe(
      'fixed inset-0 flex items-center justify-center opacity-0 transition-opacity opacity-100'
    );
    expect(modal.backdrop.className).toBe(
      'fixed inset-0 bg-black/50 opacity-0 transition-opacity opacity-100'
    );
    expect(modal.el.querySelector('.rounded-lg > .modal-header')).not.toBeNull();
    expect(document.body.className).toBe('overflow-hidden');
  });

  it('puts the backdrop right below the modal', () => {
    const modal = show();

    expect(modal.el.previousElementSibling).toBe(modal.backdrop);
  });

  it('leaves the display to your CSS unless it hides the modal', () => {
    const style = document.createElement('style');
    style.textContent = '.grid-modal { display: grid; } .modal { display: none; }';
    document.head.appendChild(style);

    expect(
      show({ templates: { container: '<div class="grid-modal"></div>' } }).el.style.display
    ).toBe('');
    expect(show().el.style.display).toBe('block');
    style.remove();
  });

  it('shows markup that is on the page', () => {
    document.body.innerHTML =
      '<div id="existing" class="modal"><div class="modal-dialog"><div class="modal-content">Hi</div></div></div>';
    const modal = show({ el: '#existing' });

    expect(modal.el.id).toBe('existing');
    expect(modal.isShown()).toBe(true);

    modal.hide();
    vi.runAllTimers();
    expect(document.getElementById('existing').style.display).toBe('none');
  });

  it('throws for a selector that matches nothing', () => {
    expect(() => new Modal({ el: '#missing' })).toThrow('Modal: element "#missing" not found.');
  });
});

describe('closing', () => {
  it('closes with data-close, and tells which element', () => {
    const dismissed = vi.fn();
    const modal = show({ footer: '<a href="#" data-close>Cancel</a>' }).on('dismiss', dismissed);
    const link = modal.el.querySelector('a[data-close]');

    click(link);
    vi.runAllTimers();

    expect(dismissed).toHaveBeenCalledWith(modal, expect.any(MouseEvent), link);
    expect(dismissed.mock.calls[0][1].defaultPrevented).toBe(true);
    expect(modal.isShown()).toBe(false);
    expect(modal.el.isConnected).toBe(false);
  });

  it('still closes with data-dismiss="modal", and with your own selector', () => {
    const modal = show({ footer: '<button data-dismiss="modal">Cancel</button>' });
    click(modal.el.querySelector('[data-dismiss]'));
    expect(modal.isShown()).toBe(false);

    const bootstrap = show({
      footer: '<button data-bs-dismiss="modal">Cancel</button>',
      selectors: { dismiss: '[data-bs-dismiss="modal"]' }
    });
    click(bootstrap.el.querySelector('[data-bs-dismiss]'));
    expect(bootstrap.isShown()).toBe(false);
  });

  it('closes with a click outside of the box, but not inside', () => {
    const modal = show({ content: '<p id="text">Text</p>' });

    click(document.getElementById('text'));
    expect(modal.isShown()).toBe(true);

    click(modal.el);
    expect(modal.isShown()).toBe(false);
  });

  it('closes with a click on the backdrop', () => {
    const modal = show();

    click(modal.backdrop);

    expect(modal.isShown()).toBe(false);
  });

  it('does not close when a press inside ends outside', () => {
    const modal = show({ content: '<p id="text">Text</p>' });

    document.getElementById('text').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    modal.el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(modal.isShown()).toBe(true);
  });

  it('keeps a static backdrop open', () => {
    const modal = show({ backdrop: 'static' });

    click(modal.el);
    click(modal.backdrop);

    expect(modal.isShown()).toBe(true);
  });

  it('closes only the topmost modal with Escape', () => {
    const lower = show();
    const upper = show();

    press('Escape');
    vi.runAllTimers();
    expect(upper.isShown()).toBe(false);
    expect(lower.isShown()).toBe(true);
    expect(document.body.classList.contains('modal-open')).toBe(true);

    press('Escape');
    vi.runAllTimers();
    expect(lower.isShown()).toBe(false);
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });

  it('ignores Escape when keyboard is false', () => {
    const modal = show({ keyboard: false });

    press('Escape');

    expect(modal.isShown()).toBe(true);
  });
});

describe('showing and hiding', () => {
  it('emits the events in order, after the transitions', () => {
    const events = [];
    const modal = create({ transition: 300, backdropTransition: 150 });
    ['show', 'showBackdrop', 'shown', 'hide', 'hidden'].forEach(name =>
      modal.on(name, arg => events.push([name, arg === modal]))
    );

    modal.show();
    vi.advanceTimersByTime(150);
    expect(events.map(([name]) => name)).toEqual(['show', 'showBackdrop']);
    vi.advanceTimersByTime(300);

    modal.hide();
    vi.advanceTimersByTime(299);
    expect(events.map(([name]) => name)).toEqual(['show', 'showBackdrop', 'shown', 'hide']);
    vi.advanceTimersByTime(1);

    expect(events).toEqual([
      ['show', true],
      ['showBackdrop', true],
      ['shown', true],
      ['hide', true],
      ['hidden', true]
    ]);
  });

  it('is not shown completely when hidden before', () => {
    const shown = vi.fn();
    const modal = create({ transition: 300 }).on('shown', shown);

    modal.show();
    modal.hide();
    vi.runAllTimers();

    expect(shown).not.toHaveBeenCalled();
    expect(document.querySelector('.modal, .modal-backdrop')).toBeNull();
  });

  it('can be shown again after it was hidden', () => {
    const modal = show({ content: 'Body' });
    modal.hide();
    vi.runAllTimers();

    modal.show();
    vi.runAllTimers();

    expect(modal.isShown()).toBe(true);
    expect(modal.el.isConnected).toBe(true);
  });

  it('toggles', () => {
    const modal = create();

    modal.toggle();
    expect(modal.isShown()).toBe(true);
    modal.toggle();
    expect(modal.isShown()).toBe(false);
  });

  it('removes listeners with off(), also those added with once()', () => {
    const listener = vi.fn();
    const modal = create().on('show', listener).once('shown', listener);

    modal.off('show', listener).off('shown', listener).show();
    vi.runAllTimers();

    expect(listener).not.toHaveBeenCalled();
  });

  it('calls a listener of once() only once', () => {
    const listener = vi.fn();
    const modal = create().once('show', listener);

    modal.show();
    vi.runAllTimers();
    modal.hide();
    vi.runAllTimers();
    modal.show();

    expect(listener).toHaveBeenCalledOnce();
  });
});

describe('scrolling', () => {
  it('locks the page until the last modal or modal layer is hidden', () => {
    const modal = show();
    const layer = new Layer('<div>Layer</div>', { behaviors: [ModalLayer] });
    layer.show();
    expect(document.body.style.overflow).toBe('hidden');

    modal.hide();
    vi.runAllTimers();
    expect(document.body.style.overflow).toBe('hidden');

    layer.destroy();
    expect(document.body.style.overflow).toBe('');
  });

  it('can be left to your CSS', () => {
    show({ lockScroll: false });

    expect(document.body.style.overflow).toBe('');
  });
});

describe('Dialog', () => {
  it('uses your container template for its own markup', () => {
    Modal.templates = { container: '<div class="fixed inset-0" data-dialog></div>' };

    const modal = new Dialog().render({
      content: '<div class="modal-dialog"><div class="modal-content">Hi</div></div>',
      dialogClassName: 'wide'
    });
    vi.runAllTimers();

    expect(modal.el.className).toBe('fixed inset-0 fade wide show');
    expect(modal.el.hasAttribute('data-dialog')).toBe(true);
    expect(modal.el.getAttribute('role')).toBe('dialog');
    modals.push(modal);
  });
});
