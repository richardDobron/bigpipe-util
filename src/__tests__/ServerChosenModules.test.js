import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let ServerJS;
let Bootloader;
let requireLazy;
let ifRequired;
let requireModule;
let registerModules;

// The modules and the Bootloader keep what they got: every test gets fresh modules.
beforeEach(async () => {
  vi.resetModules();
  ({ default: ServerJS } = await import('../ServerJS'));
  ({ default: Bootloader, requireLazy } = await import('../Bootloader'));
  ({ default: ifRequired } = await import('../core/ifRequired'));
  ({ default: requireModule, registerModules } = await import('../core/requireModule'));
  document.head.innerHTML = '';
  document.body.innerHTML = '<textarea id="post"></textarea>';
});

afterEach(() => {
  vi.useRealTimers();
});

function handle(jsmods) {
  new ServerJS().handle(jsmods);
}

describe('modules the server chooses', () => {
  it('stand for the module the server chose', () => {
    const EditorNext = { open: vi.fn() };
    registerModules({ EditorNext, EditorClassic: { open: vi.fn() } });

    handle({
      define: [['Editor', { __rc: 'EditorNext' }]],
      require: [['Editor', 'open', [{ __e: 'post' }]]]
    });

    expect(requireModule('Editor')).toBe(EditorNext);
    expect(EditorNext.open).toHaveBeenCalledWith(document.getElementById('post'));
  });

  it('are null when the server turned them off, and their calls do nothing', () => {
    const missing = vi.fn();

    handle({ define: [['Chat', { __rc: null }]] });
    expect(() => handle({ require: [['Chat', 'mount']] })).not.toThrow();

    expect(requireModule('Chat')).toBeNull();
    expect(ifRequired('Chat', vi.fn(), missing)).toBeUndefined();
    expect(missing).toHaveBeenCalledOnce();
  });

  it('load the resources of the module the server chose before it is called', () => {
    const EditorNext = { open: vi.fn() };
    Bootloader.setResourceMap({ 'editor-next.js': { type: 'js', src: '/static/editor-next.js' } });
    Bootloader.enableBootload({ EditorNext: ['editor-next.js'] });

    handle({
      define: [['Editor', { __rc: 'EditorNext' }]],
      require: [['Editor', 'open']]
    });
    expect(document.querySelector('script[src="/static/editor-next.js"]')).not.toBeNull();
    expect(Bootloader.isLoaded('Editor')).toBe(false);

    registerModules({ EditorNext });
    Bootloader.done('/static/editor-next.js');

    expect(EditorNext.open).toHaveBeenCalledOnce();
    expect(Bootloader.isLoaded('Editor')).toBe(true);
  });

  it('are loaded by requireLazy like the module the server chose', () => {
    const callback = vi.fn();
    const EditorNext = {};
    Bootloader.enableBootload({ EditorNext: ['/static/editor-next.js'] });
    handle({ define: [['Editor', { __rc: 'EditorNext' }]] });

    requireLazy(['Editor'], callback);
    registerModules({ EditorNext });
    Bootloader.done('/static/editor-next.js');

    expect(callback).toHaveBeenCalledWith(EditorNext);
  });

  it('are replaced by a later response, also by data', () => {
    registerModules({ EditorNext: 'next', EditorClassic: 'classic' });

    handle({ define: [['Editor', { __rc: 'EditorNext' }]] });
    handle({ define: [['Editor', { __rc: 'EditorClassic' }]] });
    expect(requireModule('Editor')).toBe('classic');

    handle({ define: [['Editor', { mode: 'plain' }]] });
    expect(requireModule('Editor')).toEqual({ mode: 'plain' });
  });

  it('do not stand for themselves', () => {
    vi.useFakeTimers();
    handle({
      define: [
        ['A', { __rc: 'B' }],
        ['B', { __rc: 'A' }]
      ]
    });

    expect(() => requireModule('A')).toThrow('BigPipe: module "A" stands for itself.');
  });
});
