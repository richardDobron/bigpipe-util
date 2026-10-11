import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let processQueue;
let calls;

// BigPipe is a singleton: every test gets fresh modules so pagelets do not leak between tests.
beforeEach(async () => {
  vi.resetModules();
  delete window.__bigpipe;
  ({ default: processQueue } = await import('../BigPipeQueue'));

  calls = [];
  window.require = name => ({ init: (...args) => calls.push([name, ...args]) });
  document.body.innerHTML = '<div id="pagelet_feed"></div>';
});

afterEach(() => {
  delete window.require;
  delete window.__bigpipe;
  vi.useRealTimers();
});

const pagelet = {
  id: 'feed',
  css: [],
  js: [],
  domops: [['setContent', '#pagelet_feed', false, { __html: 'Posts' }]],
  jsmods: { require: [['Feed', 'init']] },
  is_last: true
};

// What the inline scripts of the PHP library print.
function push(...items) {
  return (window.__bigpipe = window.__bigpipe || []).push(...items);
}

describe('BigPipeQueue', () => {
  it('runs the calls queued before it started, in their order', () => {
    push(['handle', { define: [['SiteData', { locale: 'sk_SK' }]] }]);
    push(['arrive', pagelet]);
    push(['handle', { require: [['Page', 'init']] }]);
    expect(document.getElementById('pagelet_feed').innerHTML).toBe('');

    processQueue();

    expect(document.getElementById('pagelet_feed').innerHTML).toBe('Posts');
    expect(calls).toEqual([['Feed'], ['Page']]);
  });

  it('runs a later call right away', () => {
    processQueue();

    push(['arrive', pagelet]);

    expect(document.getElementById('pagelet_feed').innerHTML).toBe('Posts');
  });

  it('runs every call once when it is started again', () => {
    push(['handle', { require: [['Page', 'init']] }]);

    processQueue();
    processQueue();

    expect(calls).toEqual([['Page']]);
  });

  it('reports an unknown call and runs the others', () => {
    vi.useFakeTimers();
    push(['nope', {}], ['handle', { require: [['Page', 'init']] }]);

    processQueue();

    expect(calls).toEqual([['Page']]);
    expect(() => vi.runAllTimers()).toThrow('BigPipe: unknown call "nope" in window.__bigpipe.');
  });
});

describe('ModuleRegistry', () => {
  it('starts the queue once the module loader is set', async () => {
    delete window.require;
    push(['handle', { require: [['Page', 'init']] }]);

    const { setModuleLoader } = await import('../ModuleRegistry');
    await Promise.resolve();
    expect(calls).toEqual([]);

    setModuleLoader(name => ({ init: () => calls.push([name]) }), { global: false });
    expect(calls).toEqual([['Page']]);
    setModuleLoader(null, { global: false });
  });

  it('starts the queue after the entrypoint when the page defines window.require', async () => {
    push(['handle', { require: [['Page', 'init']] }]);

    await import('../ModuleRegistry');
    await Promise.resolve();

    expect(calls).toEqual([['Page']]);
  });

  it('starts the queue at the latest once the document is parsed', async () => {
    vi.useFakeTimers();
    delete window.require;
    const { registerModules } = await import('../ModuleRegistry');
    registerModules({ Page: { init: () => calls.push(['Page']) } });
    push(['handle', { require: [['Page', 'init']] }]);
    await Promise.resolve();
    expect(calls).toEqual([]);

    vi.runAllTimers();
    expect(calls).toEqual([['Page']]);
  });
});
