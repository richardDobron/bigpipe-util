import DataStore from './DataStore';

const NAME = /^([^[\]]+)((?:\[[^[\]]*\])*)$/;
const KEY = /\[([^[\]]*)\]/g;
const CONTROLS = 'input,textarea,select,button';
const FIELDS =
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"]),textarea,select';
const BUTTONS = 'input[type="submit"],input[type="button"],button';

function getEntries(form, submitter) {
  const entries = Array.from(new FormData(form).entries());

  if (submitter && submitter.name && !submitter.disabled && form.contains(submitter)) {
    entries.push([submitter.name, submitter.value]);
  }

  return entries;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function insert(tree, name, value) {
  const match = NAME.exec(name);

  if (!match) {
    tree[name] = value;
    return;
  }

  const path = [match[1], ...Array.from(match[2].matchAll(KEY), key => key[1])];
  let node = tree;

  path.forEach((key, index) => {
    let property = key;

    if (property === '') {
      property = 0;
      while (Object.prototype.hasOwnProperty.call(node, property)) {
        property += 1;
      }
    }

    if (index === path.length - 1) {
      node[property] = value;
    } else {
      if (!isPlainObject(node[property])) {
        node[property] = Object.create(null);
      }
      node = node[property];
    }
  });
}

function finish(node) {
  if (!isPlainObject(node)) {
    return node;
  }

  const keys = Object.keys(node);
  const result = Object.fromEntries(keys.map(key => [key, finish(node[key])]));

  const isList =
    keys.length > 0 &&
    keys
      .map(Number)
      .sort((a, b) => a - b)
      .every((key, index) => key === index && String(key) === String(index));

  return isList ? keys.sort((a, b) => a - b).map(key => result[key]) : result;
}

const Form = {
  /**
   * The values of the form that would be submitted as a nested object: the fields named `a[b]`
   * and `a[]` become objects and arrays, as PHP reads them. Files are left out, see
   * createFormData().
   */
  serialize(form, submitter) {
    const tree = Object.create(null);

    getEntries(form, submitter).forEach(([name, value]) => {
      if (typeof value === 'string') {
        insert(tree, name, value);
      }
    });

    return finish(tree);
  },

  createFormData(form, submitter) {
    const data = new FormData();
    getEntries(form, submitter).forEach(([name, value]) => data.append(name, value));
    return data;
  },

  hasFiles(form) {
    return Array.from(form.querySelectorAll('input[type="file"]')).some(
      input => !input.disabled && input.files && input.files.length > 0
    );
  },

  /**
   * Disables the controls inside, or enables the ones disabled by it: a control that was disabled
   * before stays disabled.
   */
  setDisabled(root, disabled) {
    const controls = root.elements ? Array.from(root.elements) : root.querySelectorAll(CONTROLS);

    Array.from(controls).forEach(control => {
      if (control.disabled === undefined) {
        return;
      }

      const original = DataStore.get(control, 'disabledBeforeForm');

      if (disabled) {
        if (original === undefined) {
          DataStore.set(control, 'disabledBeforeForm', control.disabled);
        }
        control.disabled = true;
      } else if (original !== undefined) {
        control.disabled = original;
        DataStore.remove(control, 'disabledBeforeForm');
      }
    });
  },

  focusFirst(root) {
    const usable = control => !control.disabled && !control.closest('[hidden]');
    const element =
      Array.from(root.querySelectorAll(FIELDS)).find(usable) ||
      Array.from(root.querySelectorAll(BUTTONS)).find(usable);

    if (element) {
      element.focus();
      return true;
    }

    return false;
  }
};

export default Form;
