import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
});

async function freshWebStorage() {
  vi.resetModules();
  return (await import('../WebStorage')).default;
}

describe('WebStorage', () => {
  it('reads and writes the local and session storage', async () => {
    const WebStorage = await freshWebStorage();
    const local = WebStorage.getLocalStorage();

    expect(local).toBe(window.localStorage);
    expect(WebStorage.getSessionStorage()).toBe(window.sessionStorage);
    expect(WebStorage.setItemGuarded(local, 'draft', 'Hello')).toBeNull();
    expect(WebStorage.getItemGuarded(local, 'draft')).toBe('Hello');

    WebStorage.removeItemGuarded(local, 'draft');
    expect(WebStorage.getItemGuarded(local, 'draft')).toBeNull();
  });

  it('returns null for a storage the browser does not allow', async () => {
    vi.stubGlobal('localStorage', {
      setItem() {
        throw new Error('SecurityError');
      }
    });
    const WebStorage = await freshWebStorage();

    expect(WebStorage.getLocalStorage()).toBeNull();
    expect(WebStorage.getItemGuarded(null, 'draft')).toBeNull();
    expect(WebStorage.setItemGuarded(null, 'draft', 'Hello')).toBeInstanceOf(Error);
  });

  it('returns the error of a full storage', async () => {
    const WebStorage = await freshWebStorage();
    const full = new Error('QuotaExceededError');
    const storage = {
      setItem() {
        throw full;
      }
    };

    expect(WebStorage.setItemGuarded(storage, 'draft', 'Hello')).toBe(full);
  });
});
