import replaceTransportMarkers from "./core/replaceTransportMarkers";

function handler(dependencies, guard, context) {
  return dependencies.map(function (args) {
    guard.apply(context, args);
  });
}

export default class ServerJS {
  constructor() {
    this._relativeTo = document.body;
  }

  handle(jsMods) {
    handler(jsMods.require || [], this._handleRequire, this);
  }

  _handleRequire(modulePath, method, marker) {
    if (method && typeof method === 'string') {
      if (marker) {
        replaceTransportMarkers(this._relativeTo, marker);
      }

      const context = new (window.require(modulePath));

      if (!context[method]) {
        throw new TypeError(`Module ${modulePath} has no method "${method}"`);
      }

      context[method].apply(context, marker || []);
    } else {
      if (marker) {
        replaceTransportMarkers(this._relativeTo, marker);
      }

      new (window.require(modulePath))(...(marker || []));
    }
  }
}
