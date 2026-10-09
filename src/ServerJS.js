import replaceTransportMarkers from './core/replaceTransportMarkers';
import requireModule from './core/requireModule';

function handler(dependencies, guard, context) {
  return dependencies.map(function (args) {
    return guard.apply(context, args);
  });
}

export default class ServerJS {
  get _relativeTo() {
    return document.body;
  }

  handle(jsMods) {
    handler(jsMods.require || [], this._handleRequire, this);
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

      new (requireModule(modulePath))(...(marker || []));
    }
  }
}
