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
    expect(h.success).toHaveBeenCalledWith({ ...response, is_first: true, is_last: true });
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

  it.each([
    ['whitespace', ' \n\tfor (;;);{"payload":1}'],
    ['a byte order mark', '﻿for (;;);{"payload":1}'],
    ['the shield without a space', 'for(;;);{"payload":1}']
  ])('accepts a response with %s before it', (name, text) => {
    const h = handlers();

    send(new AsyncRequest('/save'), h);
    requests[0].respond(200, text);

    expect(h.success).toHaveBeenCalledWith(expect.objectContaining({ payload: 1 }));
    expect(h.error).not.toHaveBeenCalled();
  });

  it('rejects a response without the shield', () => {
    vi.useFakeTimers();
    const h = handlers();

    send(new AsyncRequest('/save'), h);
    requests[0].respond(200, '123456789{"payload":1}');

    expect(h.success).not.toHaveBeenCalled();
    expect(h.error).toHaveBeenCalledWith(
      requests[0],
      expect.objectContaining({ type: ERROR_TYPE.INVALID_RESPONSE })
    );
    expect(() => vi.runAllTimers()).toThrow(/without the "for \(;;\);" shield/);
  });

  it.each([
    ['null', 'for (;;);null'],
    ['a number', 'for (;;);1'],
    ['an array', 'for (;;);[]']
  ])('rejects a response that is %s', (name, text) => {
    vi.useFakeTimers();
    const h = handlers();

    send(new AsyncRequest('/save'), h);
    expect(() => requests[0].respond(200, text)).not.toThrow();

    expect(h.success).not.toHaveBeenCalled();
    expect(h.error).toHaveBeenCalledWith(
      requests[0],
      expect.objectContaining({ type: ERROR_TYPE.INVALID_RESPONSE })
    );
    expect(h.finally).toHaveBeenCalledOnce();
    expect(() => vi.runAllTimers()).toThrow(/not a BigPipe response/);
  });

  it('does not handle a response with a status other than 2xx', () => {
    const h = handlers();

    send(new AsyncRequest('/save'), h);
    requests[0].respond(304, asyncResponse({ payload: 'cached' }));

    expect(h.success).not.toHaveBeenCalled();
    expect(h.error).toHaveBeenCalledWith(
      requests[0],
      expect.objectContaining({ type: ERROR_TYPE.HTTP, status: 304 })
    );
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

describe('pre-response handler', () => {
  it('gets the response before it is applied and can drop it', () => {
    document.body.innerHTML = '<div id="target">old</div>';
    const h = handlers();
    const seen = [];
    const preResponse = vi.fn(response => {
      seen.push(document.getElementById('target').innerHTML);
      return response.payload.apply;
    });
    const response = apply =>
      asyncResponse({
        payload: { apply },
        domops: [['setContent', '#target', false, { __html: 'new' }]]
      });

    send(new AsyncRequest('/a').setPreResponseHandler(preResponse), h);
    requests[0].respond(200, response(false));

    expect(seen).toEqual(['old']);
    expect(document.getElementById('target').innerHTML).toBe('old');
    expect(h.success).not.toHaveBeenCalled();
    expect(h.finally).toHaveBeenCalledOnce();

    send(new AsyncRequest('/b').setPreResponseHandler(preResponse), h);
    requests[1].respond(200, response(true));

    expect(document.getElementById('target').innerHTML).toBe('new');
    expect(h.success).toHaveBeenCalledOnce();
  });
});

describe('retries', () => {
  it('sends a request again after a network error, as many times as the retries option', () => {
    const h = handlers();
    const transportError = vi.fn();

    send(
      new AsyncRequest('/feed')
        .setMethod('GET')
        .setOption('retries', 2)
        .setTransportErrorHandler(transportError),
      h
    );
    requests[0].fail();
    requests[1].fail();
    requests[2].respond(200, asyncResponse({ payload: 'posts' }));

    expect(requests).toHaveLength(3);
    expect(requests[2].url).toBe(requests[0].url);
    expect(h.initial).toHaveBeenCalledOnce();
    expect(transportError).not.toHaveBeenCalled();
    expect(h.success).toHaveBeenCalledWith(expect.objectContaining({ payload: 'posts' }));
    expect(h.finally).toHaveBeenCalledOnce();
  });

  it('reports the network error once the retries are used up', () => {
    const transportError = vi.fn();

    new AsyncRequest('/feed')
      .setOption('retries', 1)
      .setTransportErrorHandler(transportError)
      .send();
    requests[0].fail();
    requests[1].fail();

    expect(requests).toHaveLength(2);
    expect(transportError).toHaveBeenCalledWith(
      requests[1],
      expect.objectContaining({ type: ERROR_TYPE.NETWORK })
    );
  });

  it('does not retry an HTTP error', () => {
    const transportError = vi.fn();

    new AsyncRequest('/feed')
      .setOption('retries', 3)
      .setTransportErrorHandler(transportError)
      .send();
    requests[0].respond(500, '');

    expect(requests).toHaveLength(1);
    expect(transportError).toHaveBeenCalledOnce();
  });

  it('warns about an unknown option', () => {
    vi.stubGlobal('__DEV__', true);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(new AsyncRequest('/feed').setOption('retry', 1).getOption('retry')).toBe(1);

    expect(consoleError).toHaveBeenCalledWith('Warning: AsyncRequest: unknown option "retry".');
    consoleError.mockRestore();
  });
});

describe('abandon', () => {
  it('drops the request without calling its handlers but the finally handler', () => {
    const h = handlers();
    const transportError = vi.fn();
    document.body.innerHTML = '<button id="save"></button>';
    const button = document.getElementById('save');

    const request = new AsyncRequest('/save')
      .setStatusElement(button)
      .setTransportErrorHandler(transportError)
      .setTimeoutHandler(1000, transportError);
    send(request, h);
    request.abandon();

    expect(requests[0].aborted).toBe(true);
    expect(h.success).not.toHaveBeenCalled();
    expect(h.error).not.toHaveBeenCalled();
    expect(transportError).not.toHaveBeenCalled();
    expect(h.finally).toHaveBeenCalledOnce();
    expect(button.classList.contains('async-saving')).toBe(false);
  });
});

describe('page transitions', () => {
  it('abandons the requests of the page, unless they may outlive it', async () => {
    const { default: Arbiter } = await import('../../core/Arbiter');
    const page = handlers();
    const crossing = handlers();

    send(new AsyncRequest('/page'), page);
    send(new AsyncRequest('/crossing').setAllowCrossPageTransition(true), crossing);

    new Arbiter().inform('page_transition', { uri: new URL('/next', window.location.href) });

    expect(requests[0].aborted).toBe(true);
    expect(requests[1].aborted).toBe(false);
    expect(page.finally).toHaveBeenCalledOnce();

    requests[1].respond(200, asyncResponse({ payload: 'ok' }));
    expect(crossing.success).toHaveBeenCalledOnce();
    expect(page.success).not.toHaveBeenCalled();
  });
});

describe('streamed responses', () => {
  const part = (content, finished = false) =>
    JSON.stringify({ content, finished }) + '/*<!-- fetch-stream -->*/';

  it('handles every part of a streamed response as soon as it arrives', () => {
    document.body.innerHTML = '<ul class="feed"></ul>';
    const h = handlers();
    const append = html => ({
      domops: [['appendContent', 'ul.feed', false, { __html: html }]]
    });

    send(new AsyncRequest('/feed').setMethod('GET').setOption('stream', true), h);
    expect(requests[0].url).toMatch(/^\/feed\?__stream=1&__req=\d+$/);

    const first = part(append('<li>1</li>'));
    requests[0].progress(200, first + '{"content":');
    expect(document.querySelector('ul.feed').innerHTML).toBe('<li>1</li>');
    expect(h.success).toHaveBeenLastCalledWith(
      expect.objectContaining({ is_first: true, is_last: false })
    );

    const all = first + part(append('<li>2</li>')) + part({ payload: 'done' }, true);
    requests[0].progress(200, all);
    requests[0].respond(200, all);

    expect(document.querySelector('ul.feed').innerHTML).toBe('<li>1</li><li>2</li>');
    expect(h.success).toHaveBeenCalledTimes(3);
    expect(h.success).toHaveBeenLastCalledWith(
      expect.objectContaining({ payload: 'done', is_first: false, is_last: true })
    );
    expect(h.finally).toHaveBeenCalledOnce();
  });

  it('handles a response that is not streamed', () => {
    const h = handlers();

    send(new AsyncRequest('/feed').setOption('stream', true), h);
    requests[0].progress(200, 'for (;;);{"payload":');
    expect(h.success).not.toHaveBeenCalled();
    requests[0].respond(200, asyncResponse({ payload: 'all' }));

    expect(h.success).toHaveBeenCalledWith(
      expect.objectContaining({ payload: 'all', is_first: true, is_last: true })
    );
  });

  it('stops at a part the pre-response handler drops or that is invalid', () => {
    const dropped = handlers();
    send(
      new AsyncRequest('/a')
        .setOption('stream', true)
        .setPreResponseHandler(response => response.payload !== 'stop'),
      dropped
    );
    const stopping =
      part({ payload: 'go' }) + part({ payload: 'stop' }) + part({ payload: 'more' }, true);
    requests[0].respond(200, stopping);
    expect(dropped.success).toHaveBeenCalledOnce();

    const transportError = vi.fn();
    new AsyncRequest('/b')
      .setOption('stream', true)
      .setTransportErrorHandler(transportError)
      .send();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers();
    requests[1].respond(200, '{"broken' + '/*<!-- fetch-stream -->*/');
    expect(transportError).toHaveBeenCalledWith(
      requests[1],
      expect.objectContaining({ type: ERROR_TYPE.INVALID_RESPONSE })
    );
    vi.clearAllTimers();
  });

  it('rejects a part without content', () => {
    vi.useFakeTimers();
    const h = handlers();

    send(new AsyncRequest('/feed').setOption('stream', true), h);
    expect(() =>
      requests[0].respond(200, part({ payload: 1 }) + part(null) + part({ payload: 2 }, true))
    ).not.toThrow();

    expect(h.success).toHaveBeenCalledOnce();
    expect(h.error).toHaveBeenCalledWith(
      requests[0],
      expect.objectContaining({ type: ERROR_TYPE.INVALID_RESPONSE })
    );
    vi.clearAllTimers();
  });

  it('does not retry a request whose response already started', () => {
    const h = handlers();
    const transportError = vi.fn();

    send(
      new AsyncRequest('/feed')
        .setOption('stream', true)
        .setOption('retries', 2)
        .setTransportErrorHandler(transportError),
      h
    );
    requests[0].progress(200, part({ payload: 1 }));
    requests[0].fail();

    expect(requests).toHaveLength(1);
    expect(h.success).toHaveBeenCalledOnce();
    expect(transportError).toHaveBeenCalledOnce();
  });
});

describe('success event', () => {
  it('is dispatched on the relative element and bubbles, after the handler', () => {
    document.body.innerHTML = '<form id="form"><button id="button"></button></form>';
    const order = [];
    document.body.addEventListener('success', event =>
      order.push(['event', event.target.id, event.detail.response.payload])
    );

    new AsyncRequest('/save')
      .setRelative(document.getElementById('button'))
      .setHandler(() => order.push(['handler']))
      .send();
    requests[0].respond(200, asyncResponse({ payload: 'saved' }));

    expect(order).toEqual([['handler'], ['event', 'button', 'saved']]);
  });

  it('is not dispatched for an error response or a request without a relative element', () => {
    document.body.innerHTML = '<button id="button"></button>';
    const listener = vi.fn();
    document.body.addEventListener('success', listener);

    new AsyncRequest('/a')
      .setRelative(document.getElementById('button'))
      .setErrorHandler(() => {})
      .send();
    requests[0].respond(200, asyncResponse({ error: 1, errorSummary: 'No' }));
    new AsyncRequest('/b').send();
    requests[1].respond(200, asyncResponse({}));

    expect(listener).not.toHaveBeenCalled();
  });
});
