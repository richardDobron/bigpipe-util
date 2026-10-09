import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncRequest, { ERROR_TYPE } from '../AsyncRequest';
import { asyncResponse, installFakeXHR } from '../../__testutils__/fakeXHR';

let requests;

beforeEach(() => {
  requests = installFakeXHR();
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function handlers() {
  return {
    initial: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    finally: vi.fn()
  };
}

function send(request, h) {
  return request
    .setInitialHandler(h.initial)
    .setHandler(h.success)
    .setErrorHandler(h.error)
    .setFinallyHandler(h.finally)
    .send();
}

describe('request data', () => {
  it('sends the data of GET requests in the query string', () => {
    new AsyncRequest('/search').setMethod('get').setData({ q: 'pipe', page: 2 }).send();

    const [xhr] = requests;
    expect(xhr.method).toBe('GET');
    expect(xhr.url).toMatch(/^\/search\?q=pipe&page=2&__req=\d+$/);
    expect(xhr.body).toBeNull();
    expect(xhr.headers['Content-Type']).toBeUndefined();
  });

  it('keeps the existing query string and hash of GET requests', () => {
    new AsyncRequest('/search?sort=asc#results').setMethod('GET').setData({ q: 'pipe' }).send();

    expect(requests[0].url).toMatch(/^\/search\?sort=asc&q=pipe&__req=\d+#results$/);
  });

  it('sends the data of POST requests URL-encoded in the body', () => {
    new AsyncRequest('/save').setData({ user: { name: 'Jo & Co' } }).send();

    const [xhr] = requests;
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('/save');
    expect(xhr.body).toMatch(/^user%5Bname%5D=Jo%20%26%20Co&__req=\d+$/);
    expect(xhr.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(xhr.headers['X-Requested-With']).toBe('XMLHttpRequest');
    expect(Object.keys(xhr.headers)).toHaveLength(2);
  });

  it('sends null as an empty value and leaves out undefined values and empty arrays', () => {
    new AsyncRequest('/save')
      .setData({ a: 1, b: null, c: undefined, d: [], e: { f: null, g: {} }, h: [1, 2] })
      .send();

    expect(decodeURIComponent(requests[0].body)).toMatch(
      /^a=1&b=&e\[f\]=&h\[0\]=1&h\[1\]=2&__req=\d+$/
    );
  });

  it.each(['PUT', 'PATCH', 'DELETE'])('sends the data of %s requests URL-encoded too', method => {
    new AsyncRequest('/posts/1').setMethod(method).setData({ title: 'Hi' }).send();

    expect(requests[0].body).toMatch(/^title=Hi&__req=\d+$/);
    expect(requests[0].headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it('sends booleans as 1 and 0, so false is falsy in PHP', () => {
    new AsyncRequest('/save').setData({ active: true, archived: false }).send();

    expect(requests[0].body).toMatch(/^active=1&archived=0&__req=\d+$/);
  });

  it('does not modify the data object', () => {
    const data = { id: 1 };

    new AsyncRequest('/save').setData(data).send();

    expect(data).toEqual({ id: 1 });
  });

  it('sends the FormData of POST requests in the body', () => {
    const formData = new FormData();
    formData.append('name', 'value');

    new AsyncRequest('/save').setData(formData).send();

    const [xhr] = requests;
    expect(xhr.body).toBeInstanceOf(FormData);
    expect(xhr.body.get('name')).toBe('value');
    expect(xhr.body.get('__req')).toMatch(/^\d+$/);
    expect(xhr.headers['Content-Type']).toBeUndefined();
  });

  it('does not modify the FormData', () => {
    const formData = new FormData();
    formData.append('name', 'value');

    new AsyncRequest('/save').setData(formData).send();

    expect(formData.has('__req')).toBe(false);
  });

  it('sends the FormData of GET requests in the query string', () => {
    const formData = new FormData();
    formData.append('q', 'pipe');

    new AsyncRequest('/search').setMethod('GET').setData(formData).send();

    expect(requests[0].url).toMatch(/^\/search\?q=pipe&__req=\d+$/);
    expect(requests[0].body).toBeNull();
  });
});

describe('responses', () => {
  it('applies the response before calling the handler', () => {
    document.body.innerHTML = '<ul class="logs"></ul>';
    const h = handlers();
    h.success.mockImplementation(() => {
      expect(document.querySelector('ul.logs').innerHTML).toBe('<li>line</li>');
    });

    send(new AsyncRequest('/log'), h);
    const response = {
      payload: { ok: true },
      domops: [['appendContent', 'ul.logs', false, { __html: '<li>line</li>' }]],
      jsmods: { require: [] }
    };
    requests[0].respond(200, asyncResponse(response));

    expect(h.initial).toHaveBeenCalledOnce();
    expect(h.success).toHaveBeenCalledWith(response);
    expect(h.error).not.toHaveBeenCalled();
    expect(h.finally).toHaveBeenCalledOnce();
  });

  it('calls the error handler for error statuses', () => {
    const h = handlers();

    send(new AsyncRequest('/save'), h);
    requests[0].respond(500, 'Internal Server Error');

    expect(h.success).not.toHaveBeenCalled();
    expect(h.error).toHaveBeenCalledWith(requests[0], expect.objectContaining({ type: 'http' }));
    expect(h.finally).toHaveBeenCalledOnce();
  });

  it('calls the error and finally handlers for responses that are not valid', () => {
    vi.useFakeTimers();
    const h = handlers();

    send(new AsyncRequest('/save'), h);
    requests[0].respond(200, '<html>Fatal error</html>');

    expect(h.success).not.toHaveBeenCalled();
    expect(h.error).toHaveBeenCalledOnce();
    expect(h.finally).toHaveBeenCalledOnce();
    expect(() => vi.runAllTimers()).toThrow(/Failed to handle response/);
  });

  it('calls the finally handler when the handler throws', () => {
    const h = handlers();
    h.success.mockImplementation(() => {
      throw new Error('handler failed');
    });

    send(new AsyncRequest('/save'), h);

    expect(() => requests[0].respond(200, asyncResponse({}))).toThrow('handler failed');
    expect(h.finally).toHaveBeenCalledOnce();
  });

  it('calls the error and finally handlers for network errors', () => {
    const h = handlers();

    send(new AsyncRequest('/save'), h);
    requests[0].fail();

    expect(h.error).toHaveBeenCalledOnce();
    expect(h.finally).toHaveBeenCalledOnce();
  });
});

describe('errors', () => {
  function errorOf(respond) {
    const h = handlers();
    send(new AsyncRequest('/save'), h);
    respond(requests[0]);

    expect(h.success).not.toHaveBeenCalled();
    expect(h.error).toHaveBeenCalledOnce();
    expect(h.error.mock.calls[0][0]).toBe(requests[0]);
    expect(h.finally).toHaveBeenCalledOnce();

    return h.error.mock.calls[0][1];
  }

  it('passes the error the server sent', () => {
    const error = errorOf(xhr =>
      xhr.respond(
        200,
        asyncResponse({
          payload: { field: 'title' },
          error: 1001,
          errorSummary: 'Could not save',
          errorDescription: 'The title is too long.',
          errorIsWarning: true,
          isTransient: false
        })
      )
    );

    expect(error).toEqual({
      type: ERROR_TYPE.SERVER,
      code: 1001,
      status: 200,
      summary: 'Could not save',
      description: 'The title is too long.',
      isWarning: true,
      isTransient: false,
      payload: { field: 'title' }
    });
  });

  it('still applies the DOM operations of an error response', () => {
    document.body.innerHTML = '<p class="status"></p>';

    errorOf(xhr =>
      xhr.respond(
        200,
        asyncResponse({
          error: 1,
          errorSummary: 'Invalid',
          domops: [['setContent', '.status', false, { __html: 'Too long' }]]
        })
      )
    );

    expect(document.querySelector('.status').innerHTML).toBe('Too long');
  });

  it.each([
    [500, true],
    [503, true],
    [429, true],
    [404, false]
  ])('describes HTTP status %i (transient: %s)', (status, isTransient) => {
    const error = errorOf(xhr => xhr.respond(status, 'Error'));

    expect(error).toMatchObject({
      type: ERROR_TYPE.HTTP,
      code: status,
      status,
      summary: 'Request failed',
      description: `The server responded with status ${status}.`,
      isTransient
    });
  });

  it('describes a response that is not a BigPipe response', () => {
    vi.useFakeTimers();

    const error = errorOf(xhr => xhr.respond(200, '<html>Fatal error</html>'));

    expect(error).toMatchObject({ type: ERROR_TYPE.INVALID_RESPONSE, summary: 'Invalid response' });
    expect(() => vi.runAllTimers()).toThrow(/Failed to handle response/);
  });

  it('describes a network error as transient', () => {
    const error = errorOf(xhr => {
      xhr.status = 0;
      xhr.fail();
    });

    expect(error).toMatchObject({ type: ERROR_TYPE.NETWORK, status: 0, isTransient: true });
  });

  it('tells when the browser is offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    const error = errorOf(xhr => xhr.fail());

    expect(error.summary).toBe('No network connection');
    vi.restoreAllMocks();
  });
});

describe('status element', () => {
  let button;

  beforeEach(() => {
    document.body.innerHTML = '<button>Save</button>';
    button = document.querySelector('button');
  });

  it.each([
    ['a response', xhr => xhr.respond(200, asyncResponse({}))],
    ['an error status', xhr => xhr.respond(500, 'Error')],
    ['a network error', xhr => xhr.fail()],
    ['an abort', xhr => xhr.abort()]
  ])('has the status class until %s', (_, finish) => {
    new AsyncRequest('/save').setStatusElement(button).send();
    expect(button.className).toBe('async-saving');

    finish(requests[0]);
    expect(button.className).toBe('');
  });

  it('uses a custom status class', () => {
    new AsyncRequest('/save').setStatusElement(button).setStatusClass('is-loading').send();
    expect(button.className).toBe('is-loading');

    requests[0].respond(200, asyncResponse({}));
    expect(button.className).toBe('');
  });

  it('removes the status class when the handler throws', () => {
    new AsyncRequest('/save')
      .setStatusElement(button)
      .setHandler(() => {
        throw new Error('handler failed');
      })
      .send();

    expect(() => requests[0].respond(200, asyncResponse({}))).toThrow('handler failed');
    expect(button.className).toBe('');
  });
});

describe('upload progress', () => {
  it('passes the upload progress events to the handler', () => {
    const progress = vi.fn();

    new AsyncRequest('/upload').setData(new FormData()).setUploadProgressHandler(progress).send();
    const event = { loaded: 512, total: 1024 };
    requests[0].upload.onprogress(event);

    expect(progress).toHaveBeenCalledWith(event);
  });

  it('does not listen to upload events without a handler', () => {
    new AsyncRequest('/save').send();

    expect(requests[0].upload.onprogress).toBeUndefined();
  });
});

describe('transport error handler', () => {
  function sendWithBoth() {
    const errorHandler = vi.fn();
    const transportErrorHandler = vi.fn();

    new AsyncRequest('/save')
      .setErrorHandler(errorHandler)
      .setTransportErrorHandler(transportErrorHandler)
      .send();

    return { errorHandler, transportErrorHandler };
  }

  it.each([
    ['http', xhr => xhr.respond(500, 'Error')],
    ['invalid_response', xhr => xhr.respond(200, '<html>Fatal error</html>')],
    ['network', xhr => xhr.fail()]
  ])('handles %s errors instead of the error handler', (type, fail) => {
    vi.useFakeTimers();
    const { errorHandler, transportErrorHandler } = sendWithBoth();

    fail(requests[0]);

    expect(transportErrorHandler).toHaveBeenCalledWith(
      requests[0],
      expect.objectContaining({ type })
    );
    expect(errorHandler).not.toHaveBeenCalled();
    vi.clearAllTimers();
  });

  it('handles timeouts without a timeout handler', () => {
    vi.useFakeTimers();
    const transportErrorHandler = vi.fn();

    new AsyncRequest('/slow')
      .setTransportErrorHandler(transportErrorHandler)
      .setTimeoutHandler(1000)
      .send();
    vi.advanceTimersByTime(1000);

    expect(transportErrorHandler).toHaveBeenCalledWith(
      requests[0],
      expect.objectContaining({ type: ERROR_TYPE.TIMEOUT })
    );
  });

  it('leaves the errors the server sent to the error handler', () => {
    const { errorHandler, transportErrorHandler } = sendWithBoth();

    requests[0].respond(200, asyncResponse({ error: 1, errorSummary: 'Invalid' }));

    expect(errorHandler).toHaveBeenCalledWith(
      requests[0],
      expect.objectContaining({ type: ERROR_TYPE.SERVER })
    );
    expect(transportErrorHandler).not.toHaveBeenCalled();
  });
});

describe('timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('aborts the request and calls the timeout handler', () => {
    const h = handlers();
    const timeoutHandler = vi.fn();

    send(new AsyncRequest('/slow').setTimeoutHandler(1000, timeoutHandler), h);
    vi.advanceTimersByTime(999);
    expect(requests[0].aborted).toBe(false);

    vi.advanceTimersByTime(1);
    expect(requests[0].aborted).toBe(true);
    expect(timeoutHandler).toHaveBeenCalledWith(
      requests[0],
      expect.objectContaining({ type: ERROR_TYPE.TIMEOUT, isTransient: true })
    );
    expect(h.error).not.toHaveBeenCalled();
    expect(h.finally).toHaveBeenCalledOnce();
  });

  it('calls the error handler without a timeout handler', () => {
    const h = handlers();

    send(new AsyncRequest('/slow').setTimeoutHandler(1000), h);
    vi.advanceTimersByTime(1000);

    expect(h.error).toHaveBeenCalledWith(
      requests[0],
      expect.objectContaining({ type: ERROR_TYPE.TIMEOUT, summary: 'Request timed out' })
    );
  });

  it('does not fire after the response', () => {
    const h = handlers();

    send(new AsyncRequest('/fast').setTimeoutHandler(1000), h);
    requests[0].respond(200, asyncResponse({}));
    vi.advanceTimersByTime(1000);

    expect(requests[0].aborted).toBe(false);
    expect(h.error).not.toHaveBeenCalled();
    expect(h.finally).toHaveBeenCalledOnce();
  });

  it('is not an error when the request is aborted on purpose', () => {
    const h = handlers();

    const request = new AsyncRequest('/slow').setTimeoutHandler(1000);
    send(request, h);
    request.abort();
    vi.advanceTimersByTime(1000);

    expect(h.error).not.toHaveBeenCalled();
    expect(h.finally).toHaveBeenCalledOnce();
  });
});

describe('default error handler', () => {
  afterEach(() => {
    AsyncRequest.setDefaultErrorHandler(null);
  });

  it('handles the errors of requests without an error handler', () => {
    const defaultHandler = vi.fn();
    AsyncRequest.setDefaultErrorHandler(defaultHandler);

    new AsyncRequest('/save').send();
    requests[0].respond(500, 'Error');

    expect(defaultHandler).toHaveBeenCalledWith(
      requests[0],
      expect.objectContaining({ type: ERROR_TYPE.HTTP })
    );
  });

  it('is replaced by the error handler of the request', () => {
    const defaultHandler = vi.fn();
    const ownHandler = vi.fn();
    AsyncRequest.setDefaultErrorHandler(defaultHandler);

    new AsyncRequest('/save').setErrorHandler(ownHandler).send();
    requests[0].respond(500, 'Error');

    expect(ownHandler).toHaveBeenCalledOnce();
    expect(defaultHandler).not.toHaveBeenCalled();
  });

  it('is not called for successful requests', () => {
    const defaultHandler = vi.fn();
    AsyncRequest.setDefaultErrorHandler(defaultHandler);

    new AsyncRequest('/save').send();
    requests[0].respond(200, asyncResponse({}));

    expect(defaultHandler).not.toHaveBeenCalled();
  });
});

describe('abort', () => {
  it('aborts the sent request and calls the finally handler', () => {
    const h = handlers();
    const request = new AsyncRequest('/save');

    send(request, h);
    request.abort();

    expect(requests[0].aborted).toBe(true);
    expect(h.error).not.toHaveBeenCalled();
    expect(h.finally).toHaveBeenCalledOnce();
  });

  it('does nothing before the request is sent', () => {
    expect(() => new AsyncRequest('/save').abort()).not.toThrow();
  });
});
