import Bootloader from './Bootloader';
import invariant from './core/invariant';
import replaceTransportMarkers from './core/replaceTransportMarkers';
import reportError from './core/reportError';
import requireModule, { defineInstance, defineModule } from './core/requireModule';

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

  _handleRequireLazy(modulePath, method, marker) {
    if (Bootloader.isBootloadable(modulePath)) {
      Bootloader.loadModules([modulePath], () => this._handleRequire(modulePath, method, marker));
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
