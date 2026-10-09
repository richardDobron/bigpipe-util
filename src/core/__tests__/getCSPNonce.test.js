import { beforeEach, describe, expect, it } from 'vitest';
import getCSPNonce from '../getCSPNonce';

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('getCSPNonce', () => {
  it('returns the nonce of the first script that has one', () => {
    document.head.innerHTML = '<script src="/a.js"></script><script nonce="first"></script>';
    document.body.innerHTML = '<script nonce="second"></script>';

    expect(getCSPNonce()).toBe('first');
  });

  it('reads the nonce property, which keeps the value browsers hide from the attribute', () => {
    const script = document.createElement('script');
    script.setAttribute('nonce', '');
    Object.defineProperty(script, 'nonce', { value: 'hidden' });
    document.head.appendChild(script);

    expect(getCSPNonce()).toBe('hidden');
  });

  it('returns null when the page has no nonce', () => {
    document.head.innerHTML = '<script src="/a.js"></script>';

    expect(getCSPNonce()).toBeNull();
  });
});
