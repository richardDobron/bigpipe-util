import Bootloader from './Bootloader';
import invariant from './core/invariant';
import replaceTransportMarkers from './core/replaceTransportMarkers';
import reportError from './core/reportError';
import requireModule, { defineInstance, defineModule } from './core/requireModule';

// The class and the modules of the arguments of every instance the server defined, so that a call
// can load them first when they are bootloadable: an instance is created by the first call that
// needs it.
const instanceModules = new Map();

function addModule(name, modules) {
  if (modules.has(name)) {
    return;
  }
  modules.add(name);

  (instanceModules.get(name) || []).forEach(module => addModule(module, modules));
}

// Adds the modules of the `__m` markers in the arguments, as they are before they are replaced.
function collectModules(value, modules) {
  if (Array.isArray(value)) {
    value.forEach(item => collectModules(item, modules));
  } else if (value && typeof value === 'object') {
    if (typeof value.__m === 'string') {
      addModule(value.__m, modules);
    } else if (!value.__e && !value.__map && !value.__set) {
      Object.keys(value).forEach(key => collectModules(value[key], modules));
    }
  }
}

function handler(dependencies, guard, context) {
  dependencies.forEach(args => {
    try {
      guard.apply(context, args);
    } catch (error) {
      reportError(error);
    }
  });
}

export default class ServerJS {
  get _relativeTo() {
    return document.body;
  }

  handle(jsMods) {
    handler(jsMods.define || [], this._handleDefine, this);
    handler(jsMods.instances || [], this._handleInstance, this);
    handler(jsMods.require || [], this._handleRequireLazy, this);
  }

  _handleDefine(name, exports) {
    defineModule(name, () => {
      const holder = [exports];
      replaceTransportMarkers(this._relativeTo, holder);
      return holder[0];
    });
  }

  _handleInstance(id, modulePath, marker) {
    const modules = new Set([modulePath]);
    collectModules(marker, modules);
    instanceModules.set(id, Array.from(modules));

    defineInstance(id, () => {
      if (marker) {
        replaceTransportMarkers(this._relativeTo, marker);
      }

      const Constructor = requireModule(modulePath);
      invariant(
        typeof Constructor === 'function',
        'BigPipe: instance "%s" needs a class, module "%s" is not one.',
        id,
        modulePath
      );

      return new Constructor(...(marker || []));
    });
  }

  /**
   * Calls the module once it is loaded, with the modules of its arguments and of the instances it
   * uses, when they are bootloadable.
   */
  _handleRequireLazy(modulePath, method, marker) {
    const modules = new Set();
    addModule(modulePath, modules);
    collectModules(marker, modules);
    const bootloadable = Array.from(modules).filter(module => Bootloader.isBootloadable(module));

    if (bootloadable.length > 0) {
      Bootloader.loadModules(bootloadable, () => this._handleRequire(modulePath, method, marker));
    } else {
      this._handleRequire(modulePath, method, marker);
    }
  }

  _handleRequire(modulePath, method, marker) {
    if (method && typeof method === 'string') {
      if (marker) {
        replaceTransportMarkers(this._relativeTo, marker);
      }

      const factory = requireModule(modulePath);
      const context = typeof factory === 'function' ? new factory() : factory;

      if (!context[method]) {
        throw new TypeError(`Module ${modulePath} has no method "${method}"`);
      }

      context[method].apply(context, marker || []);
    } else {
      if (marker) {
        replaceTransportMarkers(this._relativeTo, marker);
      }

      const factory = requireModule(modulePath);

      if (typeof factory === 'function') {
        new factory(...(marker || []));
      }
    }
  }
}
