import { beforeEach, describe, expect, it, vi } from 'vitest';

let Bootloader;
let BigPipe;
let AsyncResponse;

// The Bootloader keeps what it loaded: every test gets fresh modules.
beforeEach(async () => {
  vi.resetModules();
  ({ default: Bootloader } = await import('../Bootloader'));
  ({ default: BigPipe } = await import('../BigPipe'));
  ({ default: AsyncResponse } = await import('../async/AsyncResponse'));

  document.head.innerHTML = '';
  document.body.innerHTML = '<div id="pagelet_feed"></div>';
});

const hrefs = () =>
  Array.from(document.querySelectorAll('link'), link => link.getAttribute('href'));
const srcs = () =>
  Array.from(document.querySelectorAll('script'), script => script.getAttribute('src'));

describe('Bootloader', () => {
  it('loads resources by their name in the resource map', () => {
    const callback = vi.fn();
    Bootloader.setResourceMap({
      'feed.css': { type: 'css', src: '/static/feed.1a2b.css' },
      'feed.js': { type: 'js', src: '/static/feed.3c4d.js' }
    });

    Bootloader.loadResources(['feed.css', 'feed.js'], callback);

    expect(hrefs()).toEqual(['/static/feed.1a2b.css']);
    expect(srcs()).toEqual(['/static/feed.3c4d.js']);

    document.querySelector('link').onload();
    expect(callback).not.toHaveBeenCalled();

    document.querySelector('script').onload();
    expect(callback).toHaveBeenCalledOnce();
  });

  it('loads a module script as a module, and calls back once it ran', () => {
    const callback = vi.fn();
    Bootloader.setResourceMap({
      'chat.mjs': { type: 'js', src: '/static/chat.mjs', module: true },
      'feed.js': { type: 'js', src: '/static/feed.js' }
    });

    Bootloader.loadResources(['chat.mjs', 'feed.js'], callback);

    const [chat, feed] = document.querySelectorAll('script');
    expect([chat.type, feed.type]).toEqual(['module', '']);
    chat.onload();
    feed.onload();
    expect(callback).toHaveBeenCalledOnce();
  });

  it('requests a script that failed again, then counts it as loaded and reports it', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    Bootloader.loadResources(['/feed.js'], callback);
    document.querySelector('script').onerror();
    expect(srcs()).toEqual(['/feed.js']);

    vi.advanceTimersByTime(500);
    expect(srcs()).toEqual(['/feed.js']);
    document.querySelector('script').onerror();

    vi.advanceTimersByTime(2000);
    document.querySelector('script').onerror();

    expect(callback).toHaveBeenCalledOnce();
    expect(Bootloader.getErrorURLs()).toEqual([window.location.origin + '/feed.js']);
    expect(() => vi.runAllTimers()).toThrow('Bootloader: failed to load');
    vi.useRealTimers();
  });

  it('loads a script once it loads on a retry', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    Bootloader.loadResources(['/feed.js'], callback);
    document.querySelector('script').onerror();
    vi.advanceTimersByTime(500);
    document.querySelector('script').onload();

    expect(callback).toHaveBeenCalledOnce();
    expect(Bootloader.getErrorURLs()).toEqual([]);
    vi.useRealTimers();
  });

  it('stops waiting for a stylesheet that does not load in 5 seconds', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    Bootloader.loadResources(['/feed.css', '/feed.js'], callback);
    document.querySelector('script').onload();
    vi.advanceTimersByTime(4999);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledOnce();
    expect(Bootloader.getErrorURLs()).toEqual([]);

    document.querySelector('link').onload();
    expect(callback).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('does not request a stylesheet that failed again', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    Bootloader.loadResources(['/feed.css'], callback);
    document.querySelector('link').onerror();

    expect(callback).toHaveBeenCalledOnce();
    expect(Bootloader.getErrorURLs()).toEqual([window.location.origin + '/feed.css']);
    expect(() => vi.runAllTimers()).toThrow('Bootloader: failed to load');
    vi.useRealTimers();
  });

  it('keeps the first resource of a name', () => {
    Bootloader.setResourceMap({ base: { type: 'css', src: '/base.css' } });
    Bootloader.setResourceMap({ base: { type: 'css', src: '/other.css' } });

    Bootloader.loadResources(['base']);

    expect(hrefs()).toEqual(['/base.css']);
  });

  it('loads URLs, of the given type or by their extension', () => {
    Bootloader.loadResources(['/a.css', '/b.js']);
    Bootloader.loadResources(['/c'], null, 'css');

    expect(hrefs()).toEqual(['/a.css', '/c']);
    expect(srcs()).toEqual(['/b.js']);
  });

  it('loads every URL once and calls back right away when it is loaded', () => {
    const first = vi.fn();
    const second = vi.fn();
    Bootloader.setResourceMap({ base: { type: 'css', src: '/base.css' } });

    Bootloader.loadResources(['base'], first);
    Bootloader.loadResources([window.location.origin + '/base.css'], second);
    expect(hrefs()).toEqual(['/base.css']);

    Bootloader.done('/base.css');
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();

    const third = vi.fn();
    Bootloader.loadResources(['base'], third);
    expect(third).toHaveBeenCalledOnce();
  });

  it('does not load the stylesheets and scripts already on the page', () => {
    document.head.innerHTML =
      '<link rel="stylesheet" href="/base.css"><script src="/vendor.js"></script>';
    const callback = vi.fn();

    Bootloader.loadResources(['/base.css', '/vendor.js'], callback);

    expect(document.querySelectorAll('link, script')).toHaveLength(2);
    expect(callback).toHaveBeenCalledOnce();
  });

  it('waits for an async script or a stylesheet in the body that is on the page, until the page loaded', () => {
    const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue('interactive');
    document.head.innerHTML =
      '<script src="/blocking.js"></script><script src="/app.js" type="module"></script>';
    document.body.innerHTML =
      '<link rel="stylesheet" href="/late.css"><script src="/analytics.js" async></script>';
    const blocking = vi.fn();
    const scripts = vi.fn();

    Bootloader.loadResources(['/blocking.js'], blocking);
    Bootloader.loadResources(['/app.js', '/analytics.js', '/late.css'], scripts);

    expect(blocking).toHaveBeenCalledOnce();
    expect(scripts).not.toHaveBeenCalled();
    expect(document.querySelectorAll('link, script')).toHaveLength(4);

    Bootloader.enableBootload({ Blocking: ['/blocking.js'], Analytics: ['/analytics.js'] });
    expect(Bootloader.isLoaded('Blocking')).toBe(true);
    expect(Bootloader.isLoaded('Analytics')).toBe(false);

    document.querySelector('script[src="/analytics.js"]').dispatchEvent(new Event('load'));
    expect(scripts).not.toHaveBeenCalled();

    readyState.mockReturnValue('complete');
    window.dispatchEvent(new Event('load'));
    expect(scripts).toHaveBeenCalledOnce();
    readyState.mockRestore();
  });

  it('loads the resources of a pagelet and a response by name', () => {
    window.require = () => ({});

    new AsyncResponse().handle({
      resource_map: { 'feed.css': { type: 'css', src: '/static/feed.css' } }
    });
    new BigPipe().onPageletArrive({
      id: 'feed',
      css: ['feed.css', 'chat.css'],
      js: [],
      domops: [['setContent', '#pagelet_feed', false, { __html: 'Posts' }]],
      jsmods: {},
      resource_map: { 'chat.css': { type: 'css', src: '/static/chat.css' } },
      is_last: true
    });

    expect(hrefs()).toEqual(['/static/feed.css', '/static/chat.css']);

    Bootloader.done('/static/feed.css');
    Bootloader.done('/static/chat.css');
    expect(document.getElementById('pagelet_feed').innerHTML).toBe('Posts');
    delete window.require;
  });
});

describe('bootloadable modules', () => {
  let registerModules;
  let ServerJS;
  let requireLazy;

  beforeEach(async () => {
    ({ registerModules } = await import('../core/requireModule'));
    ({ default: ServerJS } = await import('../ServerJS'));
    ({ requireLazy } = await import('../Bootloader'));

    Bootloader.setResourceMap({
      'editor.css': { type: 'css', src: '/static/editor.css' },
      'editor.js': { type: 'js', src: '/static/editor.js' }
    });
    Bootloader.enableBootload({ Editor: ['editor.css', 'editor.js'] });
  });

  function loadEditor(Editor) {
    registerModules({ Editor });
    Bootloader.done('/static/editor.css');
    Bootloader.done('/static/editor.js');
  }

  it('loads the resources of a module before requiring it', () => {
    const callback = vi.fn();
    const Editor = { open() {} };

    requireLazy(['Editor'], callback);
    expect(hrefs()).toEqual(['/static/editor.css']);
    expect(srcs()).toEqual(['/static/editor.js']);
    expect(callback).not.toHaveBeenCalled();

    loadEditor(Editor);
    expect(callback).toHaveBeenCalledWith(Editor);
  });

  it('requires a module that is not bootloadable right away', () => {
    const Page = {};
    registerModules({ Page });
    const callback = vi.fn();

    requireLazy(['Page'], callback);

    expect(callback).toHaveBeenCalledWith(Page);
  });

  it('calls a bootloadable module the server requires once it is loaded', () => {
    const Editor = { open: vi.fn() };
    document.body.innerHTML = '<textarea id="post"></textarea>';

    new ServerJS().handle({ require: [['Editor', 'open', [{ __e: 'post' }]]] });
    expect(Editor.open).not.toHaveBeenCalled();

    loadEditor(Editor);
    expect(Editor.open).toHaveBeenCalledWith(document.getElementById('post'));
  });

  it('loads a bootloadable module that a call gets as an argument', () => {
    const Editor = { name: 'editor' };
    const Page = { init: vi.fn() };
    registerModules({ Page });

    new ServerJS().handle({ require: [['Page', 'init', [{ __m: 'Editor' }]]] });
    expect(Page.init).not.toHaveBeenCalled();

    loadEditor(Editor);
    expect(Page.init).toHaveBeenCalledWith(Editor);
  });

  it('loads the bootloadable class of an instance before the instance is used', () => {
    class Editor {
      constructor(element) {
        this.element = element;
      }
      open() {
        opened.push(this.element);
      }
    }
    const opened = [];
    const Page = { init: vi.fn() };
    registerModules({ Page });
    document.body.innerHTML = '<textarea id="post"></textarea>';

    new ServerJS().handle({
      instances: [['editor_1', 'Editor', [{ __e: 'post' }]]],
      require: [
        ['editor_1', 'open'],
        ['Page', 'init', [{ __m: 'editor_1' }]]
      ]
    });
    expect(opened).toEqual([]);
    expect(Page.init).not.toHaveBeenCalled();

    loadEditor(Editor);
    expect(opened).toEqual([document.getElementById('post')]);
    expect(Page.init).toHaveBeenCalledWith(expect.any(Editor));
  });

  it('takes the bootloadable modules of a response', () => {
    new AsyncResponse().handle({
      resource_map: { 'chat.js': { type: 'js', src: '/static/chat.js' } },
      bootloadable: { Chat: ['chat.js'] }
    });

    expect(Bootloader.isBootloadable('Chat')).toBe(true);
  });
});

describe('display resources', () => {
  it('displays a pagelet once its display resources are loaded, and loads the rest with the JS', () => {
    const init = vi.fn();
    window.require = () => ({ init });
    Bootloader.setResourceMap({
      'feed.css': { type: 'css', src: '/static/feed.css' },
      'dialog.css': { type: 'css', src: '/static/dialog.css' },
      'feed.js': { type: 'js', src: '/static/feed.js' }
    });

    new BigPipe().onPageletArrive({
      id: 'feed',
      css: [],
      js: [],
      displayResources: ['feed.css'],
      allResources: ['dialog.css', 'feed.js'],
      domops: [['setContent', '#pagelet_feed', false, { __html: 'Posts' }]],
      jsmods: {},
      onload: { require: [['Feed', 'init']] },
      is_last: true
    });
    expect(hrefs()).toEqual(['/static/feed.css']);

    Bootloader.done('/static/feed.css');
    expect(document.getElementById('pagelet_feed').innerHTML).toBe('Posts');
    expect(hrefs()).toEqual(['/static/feed.css', '/static/dialog.css']);
    expect(srcs()).toEqual(['/static/feed.js']);

    Bootloader.done('/static/feed.js');
    expect(init).not.toHaveBeenCalled();

    Bootloader.done('/static/dialog.css');
    expect(init).toHaveBeenCalledOnce();
    delete window.require;
  });
});

describe('preloading', () => {
  const preloads = () =>
    Array.from(document.querySelectorAll('link[rel="preload"]'), link => [
      link.getAttribute('href'),
      link.getAttribute('as')
    ]);

  beforeEach(() => {
    Bootloader.setResourceMap({
      'dialog.css': { type: 'css', src: '/static/dialog.css' },
      'dialog.js': { type: 'js', src: '/static/dialog.js' },
      'editor.js': { type: 'js', src: '/static/editor.js' },
      'chat.js': { type: 'js', src: '/static/chat.js' }
    });
  });

  it('preloads the bootloadable modules with a priority while the network is idle', () => {
    Bootloader.loadResources(['/static/page.css']);

    Bootloader.enableBootload({
      Chat: { resources: ['chat.js'], priority: 1 },
      Dialog: { resources: ['dialog.css', 'dialog.js'], priority: 2 },
      Editor: ['editor.js']
    });
    expect(preloads()).toEqual([]);

    Bootloader.done('/static/page.css');
    expect(preloads()).toEqual([
      ['/static/dialog.css', 'style'],
      ['/static/dialog.js', 'script']
    ]);

    document.querySelector('link[href="/static/dialog.css"]').onload();
    expect(preloads().map(([href]) => href)).toContain('/static/chat.js');
    expect(preloads().map(([href]) => href)).not.toContain('/static/editor.js');
  });

  it('preloads a module script with modulepreload and runs it as a module', () => {
    const idle = [];
    vi.stubGlobal('requestIdleCallback', callback => idle.push(callback));
    Bootloader.setResourceMap({ 'editor.mjs': { type: 'js', src: '/static/editor.mjs', module: true } });
    Bootloader.enableBootload({ Editor: ['editor.mjs'] });

    Bootloader.preloadModules(['Editor']);
    expect(preloads()).toEqual([]);
    const link = document.querySelector('link[rel="modulepreload"]');
    expect(link.getAttribute('href')).toBe('/static/editor.mjs');
    expect(link.hasAttribute('as')).toBe(false);

    link.onload();
    idle.forEach(callback => callback());
    expect(document.querySelector('script').type).toBe('module');
    vi.unstubAllGlobals();
  });

  it('preloads the modules right away and runs their scripts once the browser is idle', () => {
    const idle = [];
    vi.stubGlobal('requestIdleCallback', callback => idle.push(callback));
    Bootloader.enableBootload({ Dialog: ['dialog.css', 'dialog.js'] });

    Bootloader.preloadModules(['Dialog']);
    expect(preloads()).toEqual([
      ['/static/dialog.css', 'style'],
      ['/static/dialog.js', 'script']
    ]);

    document.querySelector('link[href="/static/dialog.js"]').onload();
    expect(srcs()).toEqual([]);

    idle.forEach(callback => callback());
    expect(srcs()).toEqual(['/static/dialog.js']);
    expect(document.querySelector('link[rel="stylesheet"]')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('loads the prefetch resources of a pagelet when it arrives, then runs its prefetch jsmods', () => {
    const warm = vi.fn();
    window.require = name => (name === 'Cache' ? { warm } : {});

    new BigPipe().onPageletArrive({
      id: 'feed',
      css: ['/static/feed-blocking.css'],
      js: [],
      domops: [],
      jsmods: {},
      prefetchRsrcs: ['editor.js'],
      prefetchJsmods: { require: [['Cache', 'warm']] }
    });
    expect(srcs()).toEqual(['/static/editor.js']);
    expect(warm).not.toHaveBeenCalled();

    Bootloader.done('/static/editor.js');
    expect(warm).toHaveBeenCalledOnce();
    delete window.require;
  });
});
