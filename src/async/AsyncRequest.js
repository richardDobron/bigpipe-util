import emptyFunction from "fbjs/lib/emptyFunction";
import AsyncResponse from "./AsyncResponse";

let requests = 0;

function serialize(obj, prefix) {
  const str = [];
  for(const p in obj) {
    if (obj.hasOwnProperty(p)) {
      const k = prefix ? prefix + "[" + p + "]" : p, v = obj[p];
      str.push(typeof v == "object" ?
        serialize(v, k) :
        encodeURIComponent(k) + "=" + encodeURIComponent(v));
    }
  }
  return str.join("&");
}

function validateResponseHandler(handler) {
  const valid = !handler || typeof handler === "function";

  if (!valid) {
    console.error("AsyncRequest response handlers must be functions. Pass a function, or use bind() to build one.");
  }

  return valid;
}

export default function AsyncRequest(uri) {
  this.method = "POST";
  this.uri = "";
  this.relative = null;
  this.data = {};
  this.headers = {};
  this.initialHandler = emptyFunction;
  this.handler = null;
  this.errorHandler = emptyFunction;

  if (uri !== undefined) {
    this.setURI(uri);
  }
}

AsyncRequest.prototype.setMethod = function (method) {
  this.method = method.toString().toUpperCase();
  return this;
};

AsyncRequest.prototype.getMethod = function () {
  return this.method;
};

AsyncRequest.prototype.setRelative = function (relative) {
  this.relative = relative;
  return this;
};

AsyncRequest.prototype.getRelative = function () {
  return this.relative;
};

AsyncRequest.prototype.setData = function (obj) {
  this.data = obj;
  return this;
};

AsyncRequest.prototype.getData = function () {
  return this.data;
};

AsyncRequest.prototype.setRequestHeader = function (name, value) {
  this.headers[name] = value;
  return this;
};

AsyncRequest.prototype.setURI = function (uri) {
  this.uri = uri;

  return this;
};
AsyncRequest.prototype.getURI = function () {
  return this.uri;
};

AsyncRequest.prototype.setInitialHandler = function (fn) {
  this.initialHandler = fn;
  return this;
};

AsyncRequest.prototype.getInitialHandler = function () {
  return this.initialHandler || emptyFunction;
};

AsyncRequest.prototype.setHandler = function (fn) {
  if (validateResponseHandler(fn)) {
    this.handler = fn;
  }
  return this;
};

AsyncRequest.prototype.getHandler = function () {
  return this.handler || emptyFunction;
};

AsyncRequest.prototype.setErrorHandler = function (fn) {
  if (validateResponseHandler(fn)) {
    this.errorHandler = fn;
  }
  return this;
};

AsyncRequest.prototype.getErrorHandler = function () {
  return this.errorHandler || emptyFunction;
};

AsyncRequest.prototype.abort = function () {
  const transport = this.transport;

  if (transport) {
    transport.abort();
  }
};

AsyncRequest.prototype._unshieldResponseText = function (text) {
  const shield = "for (;;);";
  const shieldLength = shield.length;

  if (text.length <= shieldLength) {
    throw new Error("Response too short on async to " + this.getURI());
  }

  return text.substring(shieldLength);
};

AsyncRequest.prototype.send = function () {
  const {uri, method} = this;
  let { data } = this;

  const handler = this.getHandler();
  const errorHandler = this.getErrorHandler();
  const initialHandler = this.getInitialHandler();

  initialHandler();

  const request = new XMLHttpRequest();
  const self = this;

  request.open(method, uri, true);

  request.onload = function () {
    if (this.status >= 200 && this.status < 400) {
      let response;
      try {
        const safeJson = self._unshieldResponseText(this.responseText);
        response = eval("(" + safeJson + ")");
      } catch (e) {
        throw new Error("Failed to handle response: " + e.message + "\n" + this.responseText);
      }

      (new AsyncResponse).handle(response, self.relative);

      handler(response);
    } else {
      errorHandler(this);
    }
  };

  request.setRequestHeader("X-Requested-With", "XMLHttpRequest");

  requests++;

  if (this.data instanceof FormData) {
    this.data.append('__req', requests);
  } else {
    data.__req = requests;
    data = serialize(data);

    if (method === "POST") {
      request.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    }
  }

  Object.keys(this.headers).forEach((name) => {
    request.setRequestHeader(name, this.headers[name]);
  });

  request.onerror = errorHandler;
  request.send(data);

  return request;
};
