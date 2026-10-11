import { afterEach, describe, expect, it, vi } from 'vitest';
import AsyncRequest from '../async/AsyncRequest';
import ServerJS from '../ServerJS';
import ContextualLayer from '../core/layer/ContextualLayer';
import HideOnEscape from '../core/layer/HideOnEscape';
import { registerModules, requireModule, setModuleLoader } from '../ModuleRegistry';

afterEach(() => {
  setModuleLoader(null, { global: false });
  delete window.require;
});

describe('built-in modules', () => {
  it.each(['bigpipe-util/src/ServerJS', 'bigpipe-util/dist/ServerJS', 'bigpipe-util/ServerJS'])(
    'resolves %s without a loader',
    name => {
      expect(requireModule(name)).toBe(ServerJS);
    }
  );

  it('resolves modules in sub folders', () => {
    expect(requireModule('bigpipe-util/src/async/AsyncRequest')).toBe(AsyncRequest);
  });

  it('resolves the layers and their behaviors, so the server can create them', () => {
    expect(requireModule('bigpipe-util/dist/core/layer/ContextualLayer')).toBe(ContextualLayer);
    expect(requireModule('bigpipe-util/dist/core/layer/HideOnEscape')).toBe(HideOnEscape);
  });
});

describe('setModuleLoader', () => {
  it('loads application modules with the loader', () => {
    const Alert = class {};
    const loader = vi.fn(() => Alert);
    setModuleLoader(loader);

    expect(requireModule('UserLoggedInAlert')).toBe(Alert);
    expect(loader).toHaveBeenCalledWith('UserLoggedInAlert');
  });

  it('defines window.require unless told otherwise', () => {
    setModuleLoader(() => ({}), { global: false });
    expect(window.require).toBeUndefined();

    setModuleLoader(() => ({}));
    expect(window.require).toBe(requireModule);
  });

  it('feeds ServerJS, including the built-in modules requested through window.require', () => {
    const init = vi.fn();
    class Greeter {
      constructor(...args) {
        init(...args);
      }
    }
    setModuleLoader(() => Greeter);

    new ServerJS().handle({ require: [['Greeter', null, ['Marvin']]] });
    expect(init).toHaveBeenCalledWith('Marvin');

    expect(window.require('bigpipe-util/src/ServerJS')).toBe(ServerJS);
  });

  it('throws when the loader does not know the module', () => {
    setModuleLoader(() => undefined);
    expect(() => requireModule('Missing')).toThrow(/"Missing" was not found/);
  });

  it('rejects a loader that is not a function', () => {
    expect(() => setModuleLoader('nope')).toThrow(TypeError);
  });
});

describe('registerModules', () => {
  it('wins over the loader', () => {
    const Registered = class {};
    registerModules({ RegisteredModule: Registered });
    setModuleLoader(() => class {});

    expect(requireModule('RegisteredModule')).toBe(Registered);
  });
});

describe('legacy window.require', () => {
  it('is used when no loader is set', () => {
    const Legacy = class {};
    window.require = name => (name === 'Legacy' ? Legacy : undefined);

    expect(requireModule('Legacy')).toBe(Legacy);
  });

  it('still prefers the built-in modules', () => {
    window.require = () => {
      throw new Error('should not be called');
    };

    expect(requireModule('bigpipe-util/src/ServerJS')).toBe(ServerJS);
  });
});

it('explains how to fix an unresolvable module', () => {
  expect(() => requireModule('Nothing')).toThrow(
    /cannot resolve module "Nothing".*setModuleLoader/
  );
});
