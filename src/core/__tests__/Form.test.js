import { beforeEach, describe, expect, it } from 'vitest';
import Form from '../Form';

let form;

function build(html) {
  document.body.innerHTML = `<form id="form">${html}</form>`;
  form = document.getElementById('form');
}

describe('Form.serialize', () => {
  it('serializes the successful controls', () => {
    build(`
      <input name="title" value="Hello">
      <input type="checkbox" name="draft" value="1" checked>
      <input type="checkbox" name="pinned" value="1">
      <input type="radio" name="kind" value="a"><input type="radio" name="kind" value="b" checked>
      <select name="lang"><option value="sk">SK</option><option value="en" selected>EN</option></select>
      <textarea name="body">Text</textarea>
      <input name="off" value="x" disabled>
      <input type="hidden" name="token" value="t">
      <input type="file" name="file">
      <button type="button" name="plain" value="1">Plain</button>`);

    expect(Form.serialize(form)).toEqual({
      title: 'Hello',
      draft: '1',
      kind: 'b',
      lang: 'en',
      body: 'Text',
      token: 't'
    });
  });

  it('builds arrays from [] and objects from [key]', () => {
    build(`
      <input name="tags[]" value="a"><input name="tags[]" value="b">
      <input name="user[name]" value="Jo"><input name="user[address][city]" value="Nitra">
      <input name="rows[0][id]" value="1"><input name="rows[1][id]" value="2">
      <input name="sparse[1]" value="x"><input name="sparse[3]" value="y">`);

    expect(Form.serialize(form)).toEqual({
      tags: ['a', 'b'],
      user: { name: 'Jo', address: { city: 'Nitra' } },
      rows: [{ id: '1' }, { id: '2' }],
      sparse: { 1: 'x', 3: 'y' }
    });
  });

  it('keeps the last value of a repeated plain name, as PHP does', () => {
    build('<input name="a" value="1"><input name="a" value="2">');

    expect(Form.serialize(form)).toEqual({ a: '2' });
  });

  it('collects the values of a multiple select', () => {
    build(`<select name="ids[]" multiple>
      <option value="1" selected>1</option><option value="2">2</option><option value="3" selected>3</option>
    </select>`);

    expect(Form.serialize(form)).toEqual({ ids: ['1', '3'] });
  });

  it('adds the submitter that belongs to the form', () => {
    build('<input name="a" value="1"><button name="action" value="save">Save</button>');
    document.body.insertAdjacentHTML(
      'beforeend',
      '<button id="out" name="action" value="out">x</button>'
    );

    expect(Form.serialize(form, form.querySelector('button'))).toEqual({ a: '1', action: 'save' });
    expect(Form.serialize(form, document.getElementById('out'))).toEqual({ a: '1' });
  });

  it('does not let a name pollute prototypes', () => {
    build(
      '<input name="__proto__[polluted]" value="1"><input name="constructor[prototype][x]" value="1">'
    );

    Form.serialize(form);

    expect({}.polluted).toBeUndefined();
    expect({}.x).toBeUndefined();
  });
});

describe('Form.createFormData', () => {
  it('has the files and the submitter', () => {
    build(
      '<input name="a" value="1"><input type="file" name="file"><button name="go" value="1">Go</button>'
    );
    const file = new File(['abc'], 'a.txt');
    const input = form.elements.file;
    Object.defineProperty(input, 'files', { value: [file] });

    const data = Form.createFormData(form, form.querySelector('button'));

    expect(data.get('a')).toBe('1');
    expect(data.get('go')).toBe('1');
    expect(Form.hasFiles(form)).toBe(true);
  });

  it('knows when no file is chosen', () => {
    build('<input type="file" name="file">');

    expect(Form.hasFiles(form)).toBe(false);
  });
});

describe('Form.setDisabled', () => {
  beforeEach(() => {
    build(
      '<input id="a"><input id="b" disabled><button id="c">Go</button><select id="d"></select>'
    );
  });

  it('disables the controls and enables only those it disabled', () => {
    Form.setDisabled(form, true);
    expect(Array.from(form.elements).every(control => control.disabled)).toBe(true);

    Form.setDisabled(form, false);
    expect(document.getElementById('a').disabled).toBe(false);
    expect(document.getElementById('b').disabled).toBe(true);
    expect(document.getElementById('c').disabled).toBe(false);
  });

  it('works on any element holding controls', () => {
    document.body.innerHTML = '<div id="box"><input id="a"></div>';

    Form.setDisabled(document.getElementById('box'), true);

    expect(document.getElementById('a').disabled).toBe(true);
  });
});

describe('Form.focusFirst', () => {
  it('focuses the first field, before the buttons', () => {
    build('<button id="b">Go</button><input id="a">');

    expect(Form.focusFirst(form)).toBe(true);
    expect(document.activeElement.id).toBe('a');
  });

  it('skips disabled and hidden fields, and says when there is nothing to focus', () => {
    build('<input id="a" disabled><input type="hidden" id="h">');

    expect(Form.focusFirst(form)).toBe(false);
  });
});
