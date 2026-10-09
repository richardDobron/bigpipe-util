import { beforeEach, describe, expect, it } from 'vitest';
import DOM from '../DOM';
import AsyncResponse from '../../async/AsyncResponse';

beforeEach(() => {
  // Like a template rendered again by the server: the same markup, also the same whitespace.
  document.body.innerHTML =
    '<form id="form" class="old"><label>Title</label><input id="title" name="title" value="">' +
    '<p class="error">Too short</p></form>' +
    '<ul id="list"><li id="a">A</li><li id="b">B</li><li id="c">C</li></ul>';
});

describe('DOM.morph', () => {
  it('updates the element in place, so focus and typed values survive', () => {
    const form = document.getElementById('form');
    const input = document.getElementById('title');
    input.focus();
    input.value = 'typed by the user';

    DOM.morph(
      form,
      '<form id="form" class="new"><label>Title</label><input id="title" name="title" value=""><p class="error">Too long</p></form>'
    );

    expect(document.getElementById('form')).toBe(form);
    expect(form.className).toBe('new');
    expect(document.getElementById('title')).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('typed by the user');
    expect(form.querySelector('.error').textContent).toBe('Too long');
  });

  it('keeps reordered elements by their id', () => {
    const list = document.getElementById('list');
    const [a, b, c] = list.children;

    DOM.morph(list, '<ul id="list"><li id="c">C</li><li id="a">A!</li><li id="b">B</li></ul>');

    expect(Array.from(list.children)).toEqual([c, a, b]);
    expect(a.textContent).toBe('A!');
  });

  it('removes, adds and replaces elements', () => {
    const list = document.getElementById('list');

    DOM.morph(list, '<ul id="list"><li id="a">A</li><li id="d">D</li></ul>');

    expect(list.innerHTML).toBe('<li id="a">A</li><li id="d">D</li>');
  });

  it.each([
    ['empty HTML', '', 0],
    ['more elements', '<ul id="one"></ul><ul id="two"></ul>', 2]
  ])('replaces the element for %s', (_, html, count) => {
    DOM.morph(document.getElementById('list'), html);

    expect(document.getElementById('list')).toBeNull();
    expect(document.querySelectorAll('ul')).toHaveLength(count);
  });
});

describe('DOM.morphContent', () => {
  it('updates the children only and keeps the attributes of the element', () => {
    const form = document.getElementById('form');
    const input = document.getElementById('title');

    DOM.morphContent(form, '<label>Name</label><input id="title" name="title" value="">');

    expect(form.className).toBe('old');
    expect(document.getElementById('title')).toBe(input);
    expect(form.querySelector('label').textContent).toBe('Name');
    expect(form.querySelector('.error')).toBeNull();
  });
});

describe('morph DOM operations', () => {
  it('applies morph and morphContent of a response, also to the relative element', () => {
    const list = document.getElementById('list');
    const form = document.getElementById('form');
    const a = document.getElementById('a');

    new AsyncResponse().handle(
      {
        domops: [
          [
            'morph',
            '#list',
            false,
            { __html: '<ul id="list" class="done"><li id="a">A</li></ul>' }
          ],
          ['morphContent', '', true, { __html: '<p>Saved</p>' }]
        ]
      },
      form
    );

    expect(document.getElementById('list')).toBe(list);
    expect(list.className).toBe('done');
    expect(list.firstElementChild).toBe(a);
    expect(form.innerHTML).toBe('<p>Saved</p>');
  });
});

describe('morph attributes', () => {
  it('sets attributes with "@" without patching Element.prototype.setAttribute', () => {
    const original = Element.prototype.setAttribute;
    const list = document.getElementById('list');

    DOM.morph(list, '<ul id="list" @click="open = true" :class="{ open }"><li id="a">A</li></ul>');

    expect(list.getAttribute('@click')).toBe('open = true');
    expect(list.getAttribute(':class')).toBe('{ open }');
    expect(Element.prototype.setAttribute).toBe(original);
  });
});

describe('morph keys', () => {
  it('replaces a keyed element by a new keyed one and keeps the others', () => {
    const list = document.getElementById('list');
    const [a, , c] = list.children;

    DOM.morph(list, '<ul id="list"><li id="a">A</li><li id="x">X</li><li id="c">C</li></ul>');

    expect(list.innerHTML).toBe('<li id="a">A</li><li id="x">X</li><li id="c">C</li>');
    expect(list.children[0]).toBe(a);
    expect(list.children[2]).toBe(c);
  });

  it('inserts an element without a key before keyed ones and keeps them', () => {
    const list = document.getElementById('list');
    const [a, b, c] = list.children;

    DOM.morph(
      list,
      '<ul id="list"><li>new</li><li id="a">A</li><li id="b">B</li><li id="c">C</li></ul>'
    );

    expect(list.innerHTML).toBe('<li>new</li><li id="a">A</li><li id="b">B</li><li id="c">C</li>');
    expect(Array.from(list.children).slice(1)).toEqual([a, b, c]);
  });

  it('moves a keyed element in the place of one without a key', () => {
    document.body.innerHTML = '<ul id="list"><li>plain</li><li id="b">B</li></ul>';
    const list = document.getElementById('list');
    const b = document.getElementById('b');

    DOM.morph(list, '<ul id="list"><li id="b">B!</li></ul>');

    expect(list.innerHTML).toBe('<li id="b">B!</li>');
    expect(list.firstElementChild).toBe(b);
  });
});
