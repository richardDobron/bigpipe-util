import { describe, expect, it } from 'vitest';
import invariant from '../invariant';

describe('invariant', () => {
  it('does nothing when the condition holds', () => {
    expect(() => invariant(true, 'never')).not.toThrow();
  });

  it('throws the formatted message', () => {
    expect(() => invariant(false, 'Module "%s" has no method "%s".', 'Foo', 'bar')).toThrow(
      'Module "Foo" has no method "bar".'
    );
  });

  it('names the error so it is easy to spot in logs', () => {
    try {
      invariant(null, 'broken');
    } catch (error) {
      expect(error.name).toBe('Invariant Violation');
    }
    expect.assertions(1);
  });
});
