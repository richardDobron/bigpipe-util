import { beforeEach, describe, expect, it, vi } from 'vitest';

let Bootloader;
let registerModules;
let ifRequired;
let requireCond;
let requireDeferred;

beforeEach(async () => {
  vi.resetModules();
  ({ default: Bootloader } = await import('../Bootloader'));
  ({ registerModules } = await import('../core/requireModule'));
  ({ default: ifRequired } = await import('../core/ifRequired'));
  ({ default: requireCond } = await import('../core/requireCond'));
  ({ default: requireDeferred } = await import('../core/requireDeferred'));

  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

function loadScript(src) {
  document.querySelector(`script[src="${src}"]`).onload();
}

describe('ifRequired', () => {
  it('calls back with a module that is in the bundle', () => {
    registerModules({ Tooltip: { show: () => 'shown' } });

    expect(ifRequired('Tooltip', tooltip => tooltip.show())).toBe('shown');
  });

  it('skips a bootloadable module until its resources are loaded', () => {
    const found = vi.fn();
    const missing = vi.fn(() => 'missing');
    Bootloader.enableBootload({ Editor: ['/editor.js'] });
    registerModules({ Editor: { open: () => {} } });

    expect(ifRequired('Editor', found, missing)).toBe('missing');
    expect(found).not.toHaveBeenCalled();

    Bootloader.loadResources(['/editor.js']);
    expect(ifRequired('Editor', found, missing)).toBe('missing');
    expect(found).not.toHaveBeenCalled();

    loadScript('/editor.js');
    ifRequired('Editor', found, missing);
    expect(found).toHaveBeenCalledOnce();
  });

  it('works without callbacks', () => {
    expect(ifRequired('Unknown')).toBeUndefined();
    expect(ifRequired('Unknown', null, () => 'missing')).toBe('missing');
  });
});

describe('requireDeferred', () => {
  it('resolves the module once its resources are loaded', async () => {
    const Editor = { open: vi.fn() };
    Bootloader.enableBootload({ Editor: ['/editor.js'] });
    registerModules({ Editor });
    const reference = requireDeferred('Editor');
    const ready = vi.fn();
    reference.onReady(ready);

    expect(reference.getModuleId()).toBe('Editor');
    expect(reference.getModuleIfRequired()).toBeUndefined();
    expect(ready).not.toHaveBeenCalled();

    reference.preload();
    const loading = reference.load();
    loadScript('/editor.js');

    await expect(loading).resolves.toBe(Editor);
    expect(reference.getModuleIfRequired()).toBe(Editor);
    expect(ready).toHaveBeenCalledWith(Editor);
  });

  it('stops waiting when the subscription is removed', async () => {
    Bootloader.enableBootload({ Editor: ['/editor.js'] });
    registerModules({ Editor: {} });
    const ready = vi.fn();

    requireDeferred('Editor').onReady(ready).remove();
    loadScript('/editor.js');
    await Promise.resolve();

    expect(ready).not.toHaveBeenCalled();
  });

  it('rejects when the module is not found after loading', async () => {
    await expect(requireDeferred('Missing').load()).rejects.toThrow('Missing');
  });

  it('loads immediately with a callback', () => {
    const callback = vi.fn();
    registerModules({ Editor: 'editor' });

    requireDeferred('Editor').loadImmediately(callback);

    expect(callback).toHaveBeenCalledWith('editor');
  });
});

describe('requireCond', () => {
  it('requires the module of the matching branch only', () => {
    registerModules({ New: 'new' });

    expect(requireCond(true, 'New', 'Missing')).toBe('new');
    expect(requireCond(false, 'Missing', 'New')).toBe('new');
  });
});
