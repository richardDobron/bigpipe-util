import { afterEach, describe, expect, it, vi } from 'vitest';
import Cookie from '../Cookie';

afterEach(() => {
  vi.restoreAllMocks();
  ['locale', 'theme', 'a b'].forEach(name => Cookie.clear(name));
});

describe('Cookie', () => {
  it('sets, reads and clears a cookie', () => {
    Cookie.set('locale', 'sk_SK');
    Cookie.set('a b', 'c;d');

    expect(Cookie.get('locale')).toBe('sk_SK');
    expect(Cookie.get('a b')).toBe('c;d');
    expect(Cookie.get('missing')).toBeNull();

    Cookie.clear('locale');
    expect(Cookie.get('locale')).toBeNull();
  });

  it('writes the options of the cookie', () => {
    const cookie = vi.spyOn(document, 'cookie', 'set');
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 9, 10));

    Cookie.set('theme', 'dark', {
      lifetime: 24 * 60 * 60 * 1000,
      path: '/app',
      domain: 'example.org',
      secure: true,
      sameSite: 'Strict'
    });

    expect(cookie).toHaveBeenCalledWith(
      'theme=dark; path=/app; expires=Sun, 11 Oct 2026 00:00:00 GMT; domain=example.org; samesite=Strict; secure'
    );
  });
});
