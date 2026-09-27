import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncResponse from '../src/async/AsyncResponse';

beforeEach(() => {
  document.body.innerHTML = `
    <div id="card"><p class="title">Old</p></div>
    <ul class="logs"><li>first</li></ul>
    <form id="form"><p class="status"></p></form>`;
});

afterEach(() => {
  delete window.require;
});

function handle(response, element) {
  new AsyncResponse().handle(response, element);
}

describe('domops', () => {
  it.each([
    ['setContent', '<li>new</li>'],
    ['appendContent', '<li>first</li><li>new</li>'],
    ['prependContent', '<li>new</li><li>first</li>']
  ])('%s', (type, expected) => {
    handle({ domops: [[type, 'ul.logs', false, { __html: '<li>new</li>' }]] });

    expect(document.querySelector('ul.logs').innerHTML).toBe(expected);
  });

  it('inserts, replaces and removes elements', () => {
    handle({
      domops: [
        ['insertBefore', '#card', false, { __html: '<hr id="before">' }],
        ['insertAfter', '#card', false, { __html: '<hr id="after">' }],
        ['replace', '.title', false, { __html: '<h2 class="title">New</h2>' }],
        ['remove', 'ul.logs', false, null]
      ]
    });

    const card = document.getElementById('card');
    expect(card.previousElementSibling.id).toBe('before');
    expect(card.nextElementSibling.id).toBe('after');
    expect(document.querySelector('.title').outerHTML).toBe('<h2 class="title">New</h2>');
    expect(document.querySelector('ul.logs')).toBeNull();
  });

  it('hides and shows elements', () => {
    handle({ domops: [['hide', '#card', false, null]] });
    expect(document.getElementById('card').style.display).toBe('none');

    handle({ domops: [['show', '#card', false, null]] });
    expect(document.getElementById('card').style.display).toBe('');
  });

  it('evaluates code with the element as this', () => {
    handle({ domops: [['eval', '#card', false, 'this.dataset.done = "yes";']] });

    expect(document.getElementById('card').dataset.done).toBe('yes');
  });

  it('targets the relative element', () => {
    const form = document.getElementById('form');

    handle({ domops: [['setContent', '.status', true, { __html: 'Saved' }]] }, form);
    handle({ domops: [['appendContent', '', true, { __html: '<b>!</b>' }]] }, form);

    expect(form.innerHTML).toBe('<p class="status">Saved</p><b>!</b>');
  });

  it('skips operations whose selector matches nothing', () => {
    expect(() =>
      handle({ domops: [['setContent', '.missing', false, { __html: 'x' }]] })
    ).not.toThrow();
  });
});

describe('jsmods', () => {
  it('calls modules with the arguments and replaces transport markers', () => {
    const render = vi.fn();
    const UserLoggedInAlert = vi.fn();
    window.require = name =>
      name === 'ChartRenderer'
        ? class {
            render(...args) {
              render(...args);
            }
          }
        : UserLoggedInAlert;

    handle({
      jsmods: {
        require: [
          [
            'ChartRenderer',
            'render',
            [{ __e: 'card' }, { __map: [['a', 1]] }, { nested: { __set: [1, 1, 2] } }]
          ],
          ['UserLoggedInAlert', null, ['Marvin']]
        ]
      }
    });

    const [element, map, { nested }] = render.mock.calls[0];
    expect(element).toBe(document.getElementById('card'));
    expect(map).toEqual(new Map([['a', 1]]));
    expect(nested).toEqual(new Set([1, 2]));
    expect(UserLoggedInAlert).toHaveBeenCalledWith('Marvin');
  });

  it('calls methods of modules that export an object', () => {
    const ready = vi.fn();
    window.require = () => ({ ready });

    handle({ jsmods: { require: [['OrderEvents', 'ready', [{ id: 1 }]]] } });

    expect(ready).toHaveBeenCalledWith({ id: 1 });
  });

  it('throws for methods that do not exist', () => {
    window.require = () => ({});

    expect(() => handle({ jsmods: { require: [['OrderEvents', 'missing']] } })).toThrow(
      /has no method "missing"/
    );
  });
});
