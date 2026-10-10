import { describe, expect, it } from 'vitest';
import DataStore from '../DataStore';

describe('DataStore', () => {
  it('keeps data for an element without putting it on the element', () => {
    const element = document.createElement('div');
    const tooltip = { text: 'Hi' };

    expect(DataStore.set(element, 'tooltip', tooltip)).toBe(element);
    expect(DataStore.get(element, 'tooltip')).toBe(tooltip);
    expect(Object.keys(element)).toEqual([]);
    expect(DataStore.get(document.createElement('div'), 'tooltip')).toBeUndefined();
  });

  it('keeps data for a string namespace', () => {
    DataStore.set('composer', 'draft', 'Hello');

    expect(DataStore.get('composer', 'draft')).toBe('Hello');
    expect(DataStore.remove('composer', 'draft')).toBe('Hello');
    expect(DataStore.get('composer', 'draft')).toBeUndefined();
  });

  it('falls back to the data attribute and to the default value', () => {
    const element = document.createElement('div');
    element.setAttribute('data-count', '3');

    expect(DataStore.get(element, 'count')).toBe('3');
    expect(DataStore.get(element, 'page', 1)).toBe(1);
    expect(DataStore.get(element, 'page')).toBe(1);
  });

  it('purges all data of a namespace', () => {
    const element = document.createElement('div');
    DataStore.set(element, 'a', 1);
    DataStore.set(element, 'b', 2);

    DataStore.purge(element);

    expect(DataStore.get(element, 'a')).toBeUndefined();
  });

  it('requires a namespace', () => {
    expect(() => DataStore.set(null, 'a', 1)).toThrow(TypeError);
  });
});
