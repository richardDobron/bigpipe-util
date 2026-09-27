import emptyFunction from 'fbjs/lib/emptyFunction';
import AsyncResponse from './AsyncResponse';

let requests = 0;

export function incrementRequests() {
  return requests++;
}

function serialize(obj, prefix) {
  const str = [];
  for (const p in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, p)) {
      const k = prefix ? prefix + '[' + p + ']' : p,
        v = obj[p];
      str.push(
        typeof v == 'object' ? serialize(v, k) : encodeURIComponent(k) + '=' + encodeURIComponent(v)
      );
    }
  }
  return str.join('&');
}

function copyFormData(formData) {
  const copy = new FormData();
  formData.forEach((value, key) => copy.append(key, value));
  return copy;
}

function appendQueryString(uri, query) {
  if (!query) {
    return uri;
  }

  const [path, hash] = uri.split('#', 2);
  const separator = path.includes('?') ? '&' : '?';

  return path + separator + query + (hash !== undefined ? '#' + hash : '');
}

function reportError(error) {
  setTimeout(() => {
    throw error;
  }, 0);
}

function validateResponseHandler(handler) {
  const valid = !handler || typeof handler === 'function';

  if (!valid) {
    console.error(
      'AsyncRequest response handlers must be functions. Pass a function, or use bind() to build one.'
    );
  }

  return valid;
}

export default class AsyncRequest {
  constructor(uri) {
    this.method = 'POST';
    this.uri = '';
    this.relative = null;
    this.data = {};
    this.headers = {};
    this.initialHandler = emptyFunction;
    this.handler = null;
    this.finallyHandler = emptyFunction;
    this.errorHandler = emptyFunction;

    if (uri !== undefined) {
      this.setURI(uri);
    }
  }

  setMethod(method) {
    this.method = method.toString().toUpperCase();
    return this;
  }

  getMethod() {
    return this.method;
  }

  setRelative(relative) {
    this.relative = relative;
    return this;
  }

  getRelative() {
    return this.relative;
  }

  setData(obj) {
    this.data = obj;
    return this;
  }

  getData() {
    return this.data;
  }

  setRequestHeader(name, value) {
    this.headers[name] = value;
    return this;
  }

  setURI(uri) {
    this.uri = uri;

    return this;
  }
  getURI() {
    return this.uri;
  }

  setInitialHandler(fn) {
    this.initialHandler = fn;
    return this;
  }

  getInitialHandler() {
    return this.initialHandler || emptyFunction;
  }

  setHandler(fn) {
    if (validateResponseHandler(fn)) {
      this.handler = fn;
    }
    return this;
  }

  setFinallyHandler(fn) {
    this.finallyHandler = fn;
    return this;
  }

  getFinallyHandler() {
    return this.finallyHandler || emptyFunction;
  }

  getHandler() {
    return this.handler || emptyFunction;
  }

  setErrorHandler(fn) {
    if (validateResponseHandler(fn)) {
      this.errorHandler = fn;
    }
    return this;
  }

  getErrorHandler() {
    return this.errorHandler || emptyFunction;
  }

  abort() {
    const { transport } = this;

    if (transport) {
      transport.abort();
    }
  }

  _unshieldResponseText(text) {
    const shield = 'for (;;);';
    const shieldLength = shield.length;

    if (text.length <= shieldLength) {
      throw new Error('Response too short on async to ' + this.getURI());
    }

    return text.substring(shieldLength);
  }

  send() {
    const { method } = this;
    let { uri, data } = this;

    const handler = this.getHandler();
    const errorHandler = this.getErrorHandler();
    const initialHandler = this.getInitialHandler();
    const finallyHandler = this.getFinallyHandler();

    initialHandler();

    incrementRequests();

    if (data instanceof FormData) {
      data = copyFormData(data);
      data.append('__req', requests);
    } else {
      data = serialize({ ...data, __req: requests });
    }

    if (['GET', 'HEAD'].includes(method)) {
      uri = appendQueryString(
        uri,
        data instanceof FormData ? new URLSearchParams(data).toString() : data
      );
      data = null;
    }

    const request = new XMLHttpRequest();
    const self = this;

    this.transport = request;

    request.open(method, uri, true);

    request.onload = function () {
      try {
        if (this.status >= 200 && this.status < 400) {
          let response;
          try {
            const safeJson = self._unshieldResponseText(this.responseText);
            response = JSON.parse(safeJson);
          } catch (e) {
            errorHandler(this);
            reportError(
              new Error('Failed to handle response: ' + e.message + '\n' + this.responseText)
            );
            return;
          }

          new AsyncResponse().handle(response, self.relative);

          handler(response);
        } else {
          errorHandler(this);
        }
      } finally {
        finallyHandler(this);
      }
    };

    request.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

    if (typeof data === 'string' && method === 'POST') {
      request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    }

    Object.keys(this.headers).forEach(name => {
      request.setRequestHeader(name, this.headers[name]);
    });

    request.onerror = function () {
      errorHandler(this);
      finallyHandler(this);
    };

    request.onabort = function () {
      finallyHandler(this);
    };

    request.send(data);

    return request;
  }
}
