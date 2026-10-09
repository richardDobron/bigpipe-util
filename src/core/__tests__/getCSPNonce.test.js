import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import getCSPNonce, { CSP_NONCE_MODULE } from '../getCSPNonce';
import { defineModule } from '../requireModule';

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

describe('getCSPNonce with the nonce the server defines', () => {
  afterEach(() => {
    defineModule(CSP_NONCE_MODULE, () => null);
  });

  it('prefers the CSPNonce module to the scripts of the page', () => {
    document.head.innerHTML = '<script nonce="from-page"></script>';
    defineModule(CSP_NONCE_MODULE, () => 'from-server');

    expect(getCSPNonce()).toBe('from-server');
  });

  it('falls back to the scripts of the page when the module is empty', () => {
    document.head.innerHTML = '<script nonce="from-page"></script>';
    defineModule(CSP_NONCE_MODULE, () => null);

    expect(getCSPNonce()).toBe('from-page');
  });
});
