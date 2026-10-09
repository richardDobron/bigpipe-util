import emptyFunction from '../core/emptyFunction';
import reportError from '../core/reportError';
import requireModule, { isModuleDefined } from '../core/requireModule';
import warning from '../core/warning';
import AsyncResponse from './AsyncResponse';

let requests = 0;

export function incrementRequests() {
  return requests++;
}

function serialize(obj, prefix) {
  const str = [];
  for (const p in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, p) || obj[p] === undefined) {
      continue;
    }

    const k = prefix ? prefix + '[' + p + ']' : p;
    const v = obj[p];

    if (v !== null && typeof v === 'object') {
      const nested = serialize(v, k);
      if (nested) {
        str.push(nested);
      }
    } else {
      str.push(encodeURIComponent(k) + '=' + encodeURIComponent(v === null ? '' : v));
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

export const ERROR_TYPE = Object.freeze({
  // The server sent an error, see AsyncResponse::setError() in the PHP library.
  SERVER: 'server',
  // The server answered with an HTTP error status.
  HTTP: 'http',
  // The response is not a BigPipe response.
  INVALID_RESPONSE: 'invalid_response',
  // There is no response at all, e.g. the browser is offline.
  NETWORK: 'network',
  // There was no response in time, see setTimeoutHandler().
  TIMEOUT: 'timeout'
});

function createError(type, transport, fields) {
  return {
    type,
    code: null,
    status: transport.status,
    summary: '',
    description: '',
    isWarning: false,
    isTransient: false,
    payload: null,
    ...fields
  };
}

function createServerError(transport, response) {
  return createError(ERROR_TYPE.SERVER, transport, {
    code: response.error,
    summary: response.errorSummary || '',
    description: response.errorDescription || '',
    isWarning: Boolean(response.errorIsWarning),
    isTransient: Boolean(response.isTransient),
    payload: response.payload === undefined ? null : response.payload
  });
}

function createHttpError(transport) {
  const { status } = transport;

  return createError(ERROR_TYPE.HTTP, transport, {
    code: status,
    summary: 'Request failed',
    description: `The server responded with status ${status}.`,
    isTransient: status >= 500 || status === 429
  });
}

function createNetworkError(transport) {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

  return createError(ERROR_TYPE.NETWORK, transport, {
    summary: offline ? 'No network connection' : 'Network error',
    description: 'Check your internet connection and try again.',
    isTransient: true
  });
}

export const CSRF_TOKEN_MODULE = 'CSRFToken';

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

function isSameOrigin(uri) {
  try {
    return new URL(uri, window.location.href).origin === window.location.origin;
  } catch (e) {
    return false;
  }
}

function getCSRFToken(method, uri) {
  if (SAFE_METHODS.includes(method) || !isModuleDefined(CSRF_TOKEN_MODULE)) {
    return null;
  }

  if (!isSameOrigin(uri)) {
    return null;
  }

  return requireModule(CSRF_TOKEN_MODULE);
}

function hasHeader(headers, name) {
  return Object.keys(headers).some(header => header.toLowerCase() === name.toLowerCase());
}

function validateResponseHandler(handler) {
  const valid = !handler || typeof handler === 'function';

  warning(
    valid,
    'AsyncRequest response handlers must be functions. Pass a function, or use bind() to build one.'
  );

  return valid;
}

let defaultErrorHandler = null;

export default class AsyncRequest {
  /**
   * Handles the errors of requests that have no error handler, e.g. shows them in a dialog.
   * Pass null to remove it.
   */
  static setDefaultErrorHandler(fn) {
    if (fn === null || validateResponseHandler(fn)) {
      defaultErrorHandler = fn;
    }
  }

  constructor(uri) {
    this.method = 'POST';
    this.uri = '';
    this.relative = null;
    this.data = {};
    this.headers = {};
    this.initialHandler = emptyFunction;
    this.handler = null;
    this.finallyHandler = emptyFunction;
    this.errorHandler = null;
    this.statusElement = null;
    this.statusClass = 'async-saving';
    this.timeout = 0;
    this.timeoutHandler = null;
    this.transportErrorHandler = null;
    this.uploadProgressHandler = null;

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
    return this.errorHandler || defaultErrorHandler || emptyFunction;
  }

  /**
   * Handles the failures without a BigPipe response (`http`, `invalid_response`, `network` and
   * `timeout` errors), e.g. to offer to try again. The error handler handles them without it.
   */
  setTransportErrorHandler(fn) {
    if (validateResponseHandler(fn)) {
      this.transportErrorHandler = fn;
    }
    return this;
  }

  getTransportErrorHandler() {
    return this.transportErrorHandler || this.getErrorHandler();
  }

  /**
   * Called with the `ProgressEvent` of the upload (`loaded` and `total` bytes) while the data is
   * sent, e.g. to show the progress of a file upload.
   */
  setUploadProgressHandler(fn) {
    if (validateResponseHandler(fn)) {
      this.uploadProgressHandler = fn;
    }
    return this;
  }

  abort() {
    const { transport } = this;

    if (transport) {
      transport.abort();
    }
  }

  /**
   * The element gets the status class while the request is running, e.g. to show a spinner or to
   * disable a button.
   */
  setStatusElement(element) {
    this.statusElement = element;
    return this;
  }

  getStatusElement() {
    return this.statusElement;
  }

  setStatusClass(className) {
    this.statusClass = className;
    return this;
  }

  /**
   * Aborts the request when it takes longer than `timeout` milliseconds, and calls `handler`, or
   * the transport error handler when there is none, with a `timeout` error.
   */
  setTimeoutHandler(timeout, handler = null) {
    if (validateResponseHandler(handler)) {
      this.timeout = timeout;
      this.timeoutHandler = handler;
    }
    return this;
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
    const transportErrorHandler = this.getTransportErrorHandler();
    const initialHandler = this.getInitialHandler();
    const finallyHandler = this.getFinallyHandler();
    const { statusElement, statusClass, timeout } = this;
    const timeoutHandler = this.timeoutHandler || transportErrorHandler;
    let timer = null;
    let timedOut = false;

    function finish(transport) {
      clearTimeout(timer);
      if (statusElement) {
        statusElement.classList.remove(statusClass);
      }
      finallyHandler(transport);
    }

    initialHandler();

    if (statusElement) {
      statusElement.classList.add(statusClass);
    }

    incrementRequests();

    const csrf = getCSRFToken(method, uri);
    const csrfParam = csrf && csrf.param ? { [csrf.param]: csrf.token } : {};

    if (data instanceof FormData) {
      data = copyFormData(data);
      Object.keys(csrfParam).forEach(name => data.append(name, csrfParam[name]));
      data.append('__req', requests);
    } else {
      data = serialize({ ...data, ...csrfParam, __req: requests });
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

    // Listening to upload events must start before send(), see XMLHttpRequest.upload.
    if (this.uploadProgressHandler && request.upload) {
      const uploadProgressHandler = this.uploadProgressHandler;
      request.upload.onprogress = event => uploadProgressHandler(event);
    }

    request.onload = function () {
      try {
        if (this.status >= 200 && this.status < 400) {
          let response;
          try {
            const safeJson = self._unshieldResponseText(this.responseText);
            response = JSON.parse(safeJson);
          } catch (e) {
            transportErrorHandler(
              this,
              createError(ERROR_TYPE.INVALID_RESPONSE, this, {
                summary: 'Invalid response',
                description: e.message
              })
            );
            reportError(
              new Error('Failed to handle response: ' + e.message + '\n' + this.responseText)
            );
            return;
          }

          // DOM operations and modules of an error response run too, e.g. to mark an invalid field.
          new AsyncResponse().handle(response, self.relative);

          if (response.error) {
            errorHandler(this, createServerError(this, response));
          } else {
            handler(response);
          }
        } else {
          transportErrorHandler(this, createHttpError(this));
        }
      } finally {
        finish(this);
      }
    };

    request.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

    if (typeof data === 'string' && method === 'POST') {
      request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    }

    if (csrf && csrf.header && !hasHeader(this.headers, csrf.header)) {
      request.setRequestHeader(csrf.header, csrf.token);
    }

    Object.keys(this.headers).forEach(name => {
      request.setRequestHeader(name, this.headers[name]);
    });

    request.onerror = function () {
      try {
        transportErrorHandler(this, createNetworkError(this));
      } finally {
        finish(this);
      }
    };

    request.onabort = function () {
      try {
        if (timedOut) {
          timeoutHandler(
            this,
            createError(ERROR_TYPE.TIMEOUT, this, {
              summary: 'Request timed out',
              description: 'The server did not respond in time. Try again.',
              isTransient: true
            })
          );
        }
      } finally {
        finish(this);
      }
    };

    request.send(data);

    if (timeout > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        request.abort();
      }, timeout);
    }

    return request;
  }
}
