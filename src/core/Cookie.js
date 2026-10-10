function defaultSecure() {
  return typeof window !== 'undefined' && window.location.protocol === 'https:';
}

/**
 * Reads and writes cookies.
 */
const Cookie = {
  get(name) {
    const prefix = encodeURIComponent(name) + '=';
    const cookie = document.cookie.split('; ').find(part => part.startsWith(prefix));

    return cookie === undefined ? null : decodeURIComponent(cookie.slice(prefix.length));
  },

  /**
   * Sets a cookie. Options: `lifetime` in milliseconds (a session cookie without it), `path`
   * ('/' by default), `domain`, `secure` (by default on HTTPS) and `sameSite` ('Lax' by default).
   */
  set(
    name,
    value,
    { lifetime, path = '/', domain, secure = defaultSecure(), sameSite = 'Lax' } = {}
  ) {
    let cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value) + '; path=' + path;

    if (lifetime !== undefined && lifetime !== null) {
      cookie += '; expires=' + new Date(Date.now() + lifetime).toUTCString();
    }
    if (domain) {
      cookie += '; domain=' + domain;
    }
    if (sameSite) {
      cookie += '; samesite=' + sameSite;
    }
    if (secure) {
      cookie += '; secure';
    }

    document.cookie = cookie;
  },

  clear(name, { path = '/', domain } = {}) {
    let cookie =
      encodeURIComponent(name) + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=' + path;
    if (domain) {
      cookie += '; domain=' + domain;
    }

    document.cookie = cookie;
  }
};

export default Cookie;
