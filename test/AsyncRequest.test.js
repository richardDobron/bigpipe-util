import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncRequest from '../src/async/AsyncRequest';
import { asyncResponse, installFakeXHR } from './fakeXHR';

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
  // Known bug: the data of GET requests is sent in the body, which browsers ignore.
  it.fails('sends the data of GET requests in the query string', () => {
    new AsyncRequest('/search').setMethod('get').setData({ q: 'pipe', page: 2 }).send();

    const [xhr] = requests;
    expect(xhr.method).toBe('GET');
    expect(xhr.url).toMatch(/^\/search\?q=pipe&page=2&__req=\d+$/);
    expect(xhr.body).toBeNull();
    expect(xhr.headers['Content-Type']).toBeUndefined();
  });

  // Known bug: the data of GET requests is sent in the body, which browsers ignore.
  it.fails('keeps the existing query string and hash of GET requests', () => {
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
  });

  // Known bug: __req is added to the object passed to setData().
  it.fails('does not modify the data object', () => {
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

  // Known bug: __req is added to the FormData passed to setData().
  it.fails('does not modify the FormData', () => {
    const formData = new FormData();
    formData.append('name', 'value');

    new AsyncRequest('/save').setData(formData).send();

    expect(formData.has('__req')).toBe(false);
  });

  // Known bug: the data of GET requests is sent in the body, which browsers ignore.
  it.fails('sends the FormData of GET requests in the query string', () => {
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
    expect(h.error).toHaveBeenCalledWith(requests[0]);
    expect(h.finally).toHaveBeenCalledOnce();
  });

  // Known bug: an invalid response throws in onload, so the error and finally handlers aren't called.
  it.fails('calls the error and finally handlers for responses that are not valid', () => {
    vi.useFakeTimers();
    const h = handlers();

    send(new AsyncRequest('/save'), h);
    requests[0].respond(200, '<html>Fatal error</html>');

    expect(h.success).not.toHaveBeenCalled();
    expect(h.error).toHaveBeenCalledOnce();
    expect(h.finally).toHaveBeenCalledOnce();
    expect(() => vi.runAllTimers()).toThrow(/Failed to handle response/);
  });

  // Known bug: the finally handler is skipped when the handler throws.
  it.fails('calls the finally handler when the handler throws', () => {
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

describe('abort', () => {
  // Known bug: abort() reads this.transport, which is never set, so it does nothing.
  it.fails('aborts the sent request and calls the finally handler', () => {
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
