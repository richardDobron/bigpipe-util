import Arbiter from '../core/Arbiter';
import emptyFunction from '../core/emptyFunction';
import reportError from '../core/reportError';
import requireModule, { isModuleDefined } from '../core/requireModule';
import warning from '../core/warning';
import AsyncResponse from './AsyncResponse';

let requests = 0;

/** Separates the parts of a streamed response, see the `stream` option. */
export const STREAM_DELIMITER = '/*<!-- fetch-stream -->*/';

const SHIELD_REGEX = /^\s*for ?\(;;\);/;

function unshield(text) {
  const match = text.match(SHIELD_REGEX);

  return match ? text.substring(match[0].length) : null;
}

function isSuccessStatus(status) {
  return status >= 200 && status < 300;
}

function isResponseObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStreamPart(part) {
  return isResponseObject(part) && isResponseObject(part.content);
}

// The requests in flight. A page transition abandons the ones that must not outlive their page.
const pending = new Set();

new Arbiter().subscribe('page_transition', () => {
  Array.from(pending).forEach(request => {
    if (!request.getAllowCrossPageTransition()) {
      request.abandon();
    }
  });
});

export function incrementRequests() {
  return requests++;
}

function serializeValue(value) {
  if (value === null) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  return value;
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
      str.push(encodeURIComponent(k) + '=' + encodeURIComponent(serializeValue(v)));
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

const CSRF_EXPIRED_STATUS = 419;

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
    this.preResponseHandler = null;
    this.handler = null;
    this.finallyHandler = emptyFunction;
    this.errorHandler = null;
    this.statusElement = null;
    this.statusClass = 'async-saving';
    this.timeout = 0;
    this.timeoutHandler = null;
    this.transportErrorHandler = null;
    this.uploadProgressHandler = null;
    this.options = { retries: 0, stream: false };
    this.abandoned = false;
    this.allowCrossPageTransition = false;

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

  /**
   * Gets the response before its DOM operations, pagelets and modules are applied. Returning
   * false drops the response: nothing is applied and no other handler is called.
   */
  setPreResponseHandler(fn) {
    if (validateResponseHandler(fn)) {
      this.preResponseHandler = fn;
    }
    return this;
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
   * Aborts the request without calling any of its handlers but the finally handler, e.g. when its
   * response is no longer needed.
   */
  abandon() {
    this.abandoned = true;
    this.abort();
  }

  /**
   * A request is abandoned when the page is left with a page transition, see PageTransitions,
   * unless it is allowed to outlive the page, e.g. a request of the next page.
   */
  setAllowCrossPageTransition(allow) {
    this.allowCrossPageTransition = Boolean(allow);
    return this;
  }

  getAllowCrossPageTransition() {
    return this.allowCrossPageTransition;
  }

  /**
   * Sets an option of the request: `retries`, how many times a request that failed with a network
   * error is sent again (0 by default), and `stream`, to handle every part of a streamed response
   * as soon as it arrives (false by default).
   */
  setOption(name, value) {
    warning(
      Object.prototype.hasOwnProperty.call(this.options, name),
      'AsyncRequest: unknown option "%s".',
      name
    );
    this.options[name] = value;
    return this;
  }

  getOption(name) {
    return this.options[name];
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
    const unshielded = unshield(text);

    if (unshielded === null) {
      throw new Error('Response without the "for (;;);" shield on async to ' + this.getURI());
    }

    return unshielded;
  }

  send() {
    const { method } = this;

    const handler = this.getHandler();
    const errorHandler = this.getErrorHandler();
    const transportErrorHandler = this.getTransportErrorHandler();
    const initialHandler = this.getInitialHandler();
    const finallyHandler = this.getFinallyHandler();
    const { preResponseHandler } = this;
    const { statusElement, statusClass, timeout } = this;
    const timeoutHandler = this.timeoutHandler || transportErrorHandler;
    let timer = null;
    let timedOut = false;

    let finished = false;

    const finish = transport => {
      if (finished) {
        return;
      }
      finished = true;

      pending.delete(this);
      clearTimeout(timer);
      if (statusElement) {
        statusElement.classList.remove(statusClass);
      }
      finallyHandler(transport);
    };

    initialHandler();
    pending.add(this);

    if (statusElement) {
      statusElement.classList.add(statusClass);
    }

    incrementRequests();

    const stream = Boolean(this.getOption('stream'));
    const streamParam = stream ? { __stream: 1 } : {};
    const requestNumber = requests;
    let csrf = null;

    // The URL and the body of an attempt, with the CSRF token the server defines at that time.
    const prepare = () => {
      csrf = getCSRFToken(method, this.uri);
      const csrfParam = csrf && csrf.param ? { [csrf.param]: csrf.token } : {};
      let body = this.data;
      let target = this.uri;

      if (body instanceof FormData) {
        body = copyFormData(body);
        Object.keys(csrfParam).forEach(name => body.append(name, csrfParam[name]));
        Object.keys(streamParam).forEach(name => body.append(name, streamParam[name]));
        body.append('__req', requestNumber);
      } else {
        body = serialize({ ...body, ...csrfParam, ...streamParam, __req: requestNumber });
      }

      if (['GET', 'HEAD'].includes(method)) {
        target = appendQueryString(
          target,
          body instanceof FormData ? new URLSearchParams(body).toString() : body
        );
        body = null;
      }

      return { body, target };
    };

    const self = this;
    const { headers, uploadProgressHandler } = this;
    let remainingRetries = this.getOption('retries') || 0;

    let offset = 0;
    let parts = 0;
    let stopped = false;
    let restarting = false;
    let tokenRefreshed = false;

    // Handles one response, or one part of a streamed response: is_first and is_last tell which.
    const handleResponse = (transport, response, isLast) => {
      response.is_first = parts === 0;
      response.is_last = isLast;
      parts += 1;

      if (preResponseHandler && preResponseHandler(response) === false) {
        stopped = true;
        return;
      }

      // DOM operations and modules of an error response run too, e.g. to mark an invalid field.
      new AsyncResponse().handle(response, self.relative);

      // The server rejected the CSRF token and sent a new one: send the request again, once.
      if (response.csrf_refresh && !tokenRefreshed && parts === 1) {
        tokenRefreshed = true;
        restarting = true;
        stopped = true;
        open();
        return;
      }

      if (response.error && !response.errorIsWarning) {
        errorHandler(transport, createServerError(transport, response));
      } else {
        handler(response);

        if (isLast && self.relative instanceof Element) {
          self.relative.dispatchEvent(
            new CustomEvent('success', { bubbles: true, detail: { response } })
          );
        }
      }
    };

    const reportInvalidResponse = (transport, description, text) => {
      stopped = true;
      transportErrorHandler(
        transport,
        createError(ERROR_TYPE.INVALID_RESPONSE, transport, {
          summary: 'Invalid response',
          description
        })
      );
      reportError(new Error('Failed to handle response: ' + description + '\n' + text));
    };

    // Parses a response, or a part of a streamed response, and reports it when it is not valid.
    const parse = (transport, text, isValid = isResponseObject) => {
      let value;
      try {
        value = JSON.parse(text);
      } catch (e) {
        reportInvalidResponse(transport, e.message, text);
        return null;
      }

      if (!isValid(value)) {
        reportInvalidResponse(transport, 'The response is not a BigPipe response.', text);
        return null;
      }

      return value;
    };

    // Handles the parts of a streamed response received so far, and the rest once it is complete.
    // A server that does not stream sends a single response, which is handled once it is complete.
    const readParts = (transport, complete) => {
      const text = transport.responseText || '';

      if (parts === 0 && SHIELD_REGEX.test(text)) {
        if (complete) {
          const response = parse(transport, unshield(text));
          if (response) {
            handleResponse(transport, response, true);
          }
        }
        return;
      }

      let end = text.indexOf(STREAM_DELIMITER, offset);
      while (!stopped && end !== -1) {
        const part = parse(transport, text.slice(offset, end), isStreamPart);
        offset = end + STREAM_DELIMITER.length;
        if (part) {
          handleResponse(transport, part.content, Boolean(part.finished));
        }
        end = text.indexOf(STREAM_DELIMITER, offset);
      }

      const rest = text.slice(offset).trim();
      if (complete && !stopped && rest) {
        offset = text.length;
        const part = parse(transport, rest, isStreamPart);
        if (part) {
          handleResponse(transport, part.content, true);
        }
      }
    };

    const open = () => {
      const request = new XMLHttpRequest();
      const { body, target } = prepare();

      this.transport = request;
      timedOut = false;
      offset = 0;
      parts = 0;
      stopped = false;

      request.open(method, target, true);

      // Listening to upload events must start before send(), see XMLHttpRequest.upload.
      if (uploadProgressHandler && request.upload) {
        request.upload.onprogress = event => {
          if (!self.abandoned) {
            uploadProgressHandler(event);
          }
        };
      }

      request.onload = function () {
        try {
          if (self.abandoned) {
            return;
          }

          if (isSuccessStatus(this.status)) {
            if (stream) {
              readParts(this, true);
              return;
            }

            let text;
            try {
              text = self._unshieldResponseText(this.responseText);
            } catch (e) {
              reportInvalidResponse(this, e.message, this.responseText);
              return;
            }

            const response = parse(this, text);
            if (response) {
              handleResponse(this, response, true);
            }
          } else if (
            this.status === CSRF_EXPIRED_STATUS &&
            csrf &&
            csrf.refresh &&
            !tokenRefreshed &&
            isSameOrigin(csrf.refresh)
          ) {
            // The token expired: get a new one from the URL the server named, then try again once.
            const failed = this;
            tokenRefreshed = true;
            restarting = true;

            new AsyncRequest(csrf.refresh)
              .setMethod('GET')
              .setAllowCrossPageTransition(true)
              .setHandler(() => {
                if (self.abandoned) {
                  finish(failed);
                } else {
                  open();
                }
              })
              .setErrorHandler(() => {
                transportErrorHandler(failed, createHttpError(failed));
                finish(failed);
              })
              .setTransportErrorHandler(() => {
                transportErrorHandler(failed, createHttpError(failed));
                finish(failed);
              })
              .send();
          } else {
            transportErrorHandler(this, createHttpError(this));
          }
        } finally {
          if (restarting) {
            restarting = false;
          } else {
            finish(this);
          }
        }
      };

      request.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

      if (typeof body === 'string') {
        request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      }

      if (csrf && csrf.header && !hasHeader(this.headers, csrf.header)) {
        request.setRequestHeader(csrf.header, csrf.token);
      }

      Object.keys(headers).forEach(name => {
        request.setRequestHeader(name, headers[name]);
      });

      if (stream) {
        request.onprogress = function () {
          if (!self.abandoned && isSuccessStatus(this.status)) {
            readParts(this, false);
          }
        };
      }

      request.onerror = function () {
        if (!self.abandoned && parts === 0 && remainingRetries > 0) {
          remainingRetries -= 1;
          open();
          return;
        }

        try {
          if (!self.abandoned) {
            transportErrorHandler(this, createNetworkError(this));
          }
        } finally {
          finish(this);
        }
      };

      request.onabort = function () {
        try {
          if (timedOut && !self.abandoned) {
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

      request.send(body);

      if (timeout > 0) {
        clearTimeout(timer);
        timer = setTimeout(() => {
          timedOut = true;
          request.abort();
        }, timeout);
      }

      return request;
    };

    return open();
  }
}
