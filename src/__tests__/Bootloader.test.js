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

    document.querySelector('script').onerror();
    expect(callback).toHaveBeenCalledOnce();
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

  it('takes the bootloadable modules of a response', () => {
    new AsyncResponse().handle({
      resource_map: { 'chat.js': { type: 'js', src: '/static/chat.js' } },
      bootloadable: { Chat: ['chat.js'] }
    });

    expect(Bootloader.isBootloadable('Chat')).toBe(true);
  });
});
