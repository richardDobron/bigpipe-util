import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let AsyncResponse;
let calls;

// BigPipe is a singleton: every test gets fresh modules so pagelets do not leak between tests.
beforeEach(async () => {
  vi.resetModules();
  ({ default: AsyncResponse } = await import('../AsyncResponse'));

  calls = [];
  window.require = name => ({ init: (...args) => calls.push([name, ...args]) });
  document.head.innerHTML = '';
  document.body.innerHTML = '<div id="placeholder" data-bigpipe-src="/pagelet/feed">Loading…</div>';
});

afterEach(() => {
  delete window.require;
});

function feedPagelet(css = []) {
  return {
    id: 'feed',
    css,
    js: [],
    domops: [['setContent', '#u_1_0', false, { __html: '<p id="post">Post</p>' }]],
    jsmods: { require: [['Feed', 'init', [{ __e: 'post' }]]] },
    is_last: true
  };
}

describe('pagelets of a response', () => {
  it('puts the pagelet in the place of the placeholder and runs its modules', () => {
    const placeholder = document.getElementById('placeholder');

    new AsyncResponse().handle(
      {
        domops: [['replace', '', true, { __html: '<div id="u_1_0"></div>' }]],
        pagelets: [feedPagelet()],
        jsmods: { require: [['Page', 'init']] }
      },
      placeholder
    );

    expect(document.getElementById('placeholder')).toBeNull();
    expect(document.getElementById('u_1_0').innerHTML).toBe('<p id="post">Post</p>');
    expect(calls).toEqual([['Feed', document.getElementById('post')], ['Page']]);
  });

  it('shows the pagelet once its stylesheet is loaded', () => {
    new AsyncResponse().handle(
      {
        domops: [['replace', '', true, { __html: '<div id="u_1_0"></div>' }]],
        pagelets: [feedPagelet(['/css/feed.css'])]
      },
      document.getElementById('placeholder')
    );
    expect(document.getElementById('u_1_0').innerHTML).toBe('');

    document.querySelector('link[href="/css/feed.css"]').onload();

    expect(document.getElementById('u_1_0').innerHTML).toBe('<p id="post">Post</p>');
    expect(calls).toEqual([['Feed', document.getElementById('post')]]);
  });
});
