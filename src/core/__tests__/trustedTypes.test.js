import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A browser with Trusted Types: the policy wraps the values it creates.
class Trusted {
  constructor(kind, value) {
    this.kind = kind;
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

let created;

function installTrustedTypes(createPolicy) {
  window.trustedTypes = {
    createPolicy: vi.fn(
      createPolicy ||
        ((name, rules) => ({
          createHTML: html =>
            created.push(['html', html]) && new Trusted('html', rules.createHTML(html)),
          createScript: code =>
            created.push(['script', code]) && new Trusted('script', rules.createScript(code)),
          createScriptURL: url =>
            created.push(['url', url]) && new Trusted('url', rules.createScriptURL(url))
        }))
    )
  };
}

beforeEach(() => {
  vi.resetModules();
  created = [];
  document.head.innerHTML = '';
  document.body.innerHTML = '<div id="target"></div>';
});

afterEach(() => {
  delete window.trustedTypes;
  vi.restoreAllMocks();
});

describe('Trusted Types', () => {
  it('inserts the HTML of the server through the bigpipe policy, created once', async () => {
    installTrustedTypes();
    const { default: DOM } = await import('../DOM');
    const target = document.getElementById('target');

    DOM.setContent(target, '<p>One</p>');
    DOM.appendContent(target, '<p>Two</p>');
    DOM.morphContent(target, '<p>Three</p>');

    expect(target.innerHTML).toBe('<p>Three</p>');
    expect(created.map(([kind]) => kind)).toEqual(['html', 'html', 'html']);
    expect(window.trustedTypes.createPolicy).toHaveBeenCalledOnce();
    expect(window.trustedTypes.createPolicy).toHaveBeenCalledWith('bigpipe', expect.any(Object));
  });

  it('loads the scripts of the Bootloader through it', async () => {
    installTrustedTypes();
    const { default: Bootloader } = await import('../../Bootloader');

    Bootloader.loadResources(['/static/feed.js']);

    expect(created).toEqual([['url', '/static/feed.js']]);
    expect(document.querySelector('script').getAttribute('src')).toBe('/static/feed.js');
  });

  it('runs the code of the deprecated eval DOM operation through it', async () => {
    installTrustedTypes();
    const { default: AsyncDOM } = await import('../../async/AsyncDOM');

    new AsyncDOM().invoke([['eval', '#target', false, 'this.dataset.ran = "1";']]);

    expect(created).toEqual([['script', 'this.dataset.ran = "1";']]);
    expect(document.getElementById('target').dataset.ran).toBe('1');
  });

  it('inserts strings when the browser has no Trusted Types or the policy is not allowed', async () => {
    installTrustedTypes(() => {
      throw new TypeError('Policy "bigpipe" disallowed.');
    });
    const { default: DOM } = await import('../DOM');

    DOM.setContent(document.getElementById('target'), '<p>Plain</p>');

    expect(document.getElementById('target').innerHTML).toBe('<p>Plain</p>');
  });
});
