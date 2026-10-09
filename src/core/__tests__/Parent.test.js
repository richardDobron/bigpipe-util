import { beforeEach, describe, expect, it } from 'vitest';
import { byAttribute, byClass, byTag } from '../Parent';

beforeEach(() => {
  document.body.innerHTML =
    '<div class="card active" data-id="1"><a href="#"><span id="leaf">x</span></a></div>';
});

describe('Parent', () => {
  it('finds the closest ancestor by class', () => {
    const leaf = document.getElementById('leaf');

    expect(byClass(leaf, 'active')).toBe(document.querySelector('.card'));
    expect(byClass(leaf, 'missing')).toBeNull();
  });

  it('finds the closest ancestor by tag and attribute', () => {
    const leaf = document.getElementById('leaf');

    expect(byTag(leaf, 'a')).toBe(document.querySelector('a'));
    expect(byAttribute(leaf, 'data-id')).toBe(document.querySelector('.card'));
  });
});
