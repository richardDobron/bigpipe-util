import Bootloader from './Bootloader';
import invariant from './core/invariant';
import replaceTransportMarkers from './core/replaceTransportMarkers';
import reportError from './core/reportError';
import requireModule, {
  defineCondition,
  defineInstance,
  defineModule,
  resolveCondition
} from './core/requireModule';

// The class and the modules of the arguments of every instance the server defined, so that a call
// can load them first when they are bootloadable: an instance is created by the first call that
// needs it.
const instanceModules = new Map();

function addModule(name, modules) {
  if (modules.has(name)) {
    return;
  }
  modules.add(name);

  // A module the server chose an implementation for needs that one.
  const target = resolveCondition(name);
  if (target !== null && target !== name) {
    addModule(target, modules);
  }

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

function isCondition(exports) {
  return (
    exports !== null &&
    typeof exports === 'object' &&
    Object.keys(exports).length === 1 &&
    Object.prototype.hasOwnProperty.call(exports, '__rc') &&
    (exports.__rc === null || typeof exports.__rc === 'string')
  );
}

function handler(dependencies, guard, context, relativeTo) {
  dependencies.forEach(args => {
    try {
      guard.call(context, relativeTo, ...args);
    } catch (error) {
      reportError(error);
    }
  });
}

export default class ServerJS {
  /**
   * Handles the modules of a response. `relativeTo` is the element that sent its request, which a
   * `__rel` marker stands for.
   */
  handle(jsMods, relativeTo = null) {
    handler(jsMods.define || [], this._handleDefine, this, relativeTo);
    handler(jsMods.instances || [], this._handleInstance, this, relativeTo);
    handler(jsMods.require || [], this._handleRequireLazy, this, relativeTo);
  }

  _handleDefine(relativeTo, name, exports) {
    // {"__rc": "EditorNext"}: the server chose the module that `name` stands for, or null.
    if (isCondition(exports)) {
      defineCondition(name, exports.__rc);
      return;
    }

    defineModule(name, () => {
      const holder = [exports];
      replaceTransportMarkers(relativeTo, holder);
      return holder[0];
    });
  }

  _handleInstance(relativeTo, id, modulePath, marker) {
    const modules = new Set([modulePath]);
    collectModules(marker, modules);
    instanceModules.set(id, Array.from(modules));

    defineInstance(id, () => {
      if (marker) {
        replaceTransportMarkers(relativeTo, marker);
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
  _handleRequireLazy(relativeTo, modulePath, method, marker) {
    const modules = new Set();
    addModule(modulePath, modules);
    collectModules(marker, modules);
    const bootloadable = Array.from(modules).filter(module => Bootloader.isBootloadable(module));

    if (bootloadable.length > 0) {
      Bootloader.loadModules(bootloadable, () =>
        this._handleRequire(relativeTo, modulePath, method, marker)
      );
    } else {
      this._handleRequire(relativeTo, modulePath, method, marker);
    }
  }

  _handleRequire(relativeTo, modulePath, method, marker) {
    if (method && typeof method === 'string') {
      if (marker) {
        replaceTransportMarkers(relativeTo, marker);
      }

      const factory = requireModule(modulePath);

      // The server turned the module off, see defineCondition().
      if (factory === null) {
        return;
      }

      const context = typeof factory === 'function' ? new factory() : factory;

      if (!context[method]) {
        throw new TypeError(`Module ${modulePath} has no method "${method}"`);
      }

      context[method].apply(context, marker || []);
    } else {
      if (marker) {
        replaceTransportMarkers(relativeTo, marker);
      }

      const factory = requireModule(modulePath);

      if (typeof factory === 'function') {
        new factory(...(marker || []));
      }
    }
  }
}
