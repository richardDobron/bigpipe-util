import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncRequest, { CSRF_TOKEN_MODULE, ERROR_TYPE } from '../AsyncRequest';
import ServerJS from '../../ServerJS';
import { asyncResponse, installFakeXHR } from '../../__testutils__/fakeXHR';

let requests;

function defineToken(exports) {
  new ServerJS().handle({ define: [[CSRF_TOKEN_MODULE, exports]] });
}

beforeEach(() => {
  requests = installFakeXHR();
  defineToken({ token: 's3cr3t', header: 'X-CSRF-TOKEN', param: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CSRF token', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('sends the token with %s requests', method => {
    new AsyncRequest('/save').setMethod(method).send();

    expect(requests[0].headers['X-CSRF-TOKEN']).toBe('s3cr3t');
  });

  it.each(['GET', 'HEAD'])('does not send the token with %s requests', method => {
    new AsyncRequest('/search').setMethod(method).send();

    expect(requests[0].headers['X-CSRF-TOKEN']).toBeUndefined();
  });

  it('sends the token to the same origin only', () => {
    new AsyncRequest(window.location.origin + '/save').send();
    new AsyncRequest('https://other.example/save').send();
    new AsyncRequest('//other.example/save').send();

    expect(requests[0].headers['X-CSRF-TOKEN']).toBe('s3cr3t');
    expect(requests[1].headers['X-CSRF-TOKEN']).toBeUndefined();
    expect(requests[2].headers['X-CSRF-TOKEN']).toBeUndefined();
  });

  it('sends the token as a field of the data', () => {
    defineToken({ token: 's3cr3t', header: null, param: '_token' });

    new AsyncRequest('/save').setData({ title: 'Hi' }).send();
    const form = new FormData();
    form.append('title', 'Hi');
    new AsyncRequest('/save').setData(form).send();

    expect(requests[0].body).toMatch(/^title=Hi&_token=s3cr3t&__req=\d+$/);
    expect(requests[0].headers['X-CSRF-TOKEN']).toBeUndefined();
    expect(requests[1].body.get('_token')).toBe('s3cr3t');
    expect(form.has('_token')).toBe(false);
  });

  it('keeps a header set on the request', () => {
    new AsyncRequest('/save').setRequestHeader('x-csrf-token', 'own').send();

    expect(requests[0].headers).toEqual(expect.objectContaining({ 'x-csrf-token': 'own' }));
    expect(requests[0].headers['X-CSRF-TOKEN']).toBeUndefined();
  });

  it('uses the token a later response defines', () => {
    new AsyncRequest('/rotate').send();
    requests[0].respond(
      200,
      asyncResponse({
        jsmods: { define: [[CSRF_TOKEN_MODULE, { token: 'n3w', header: 'X-CSRF-TOKEN' }]] }
      })
    );

    new AsyncRequest('/save').send();

    expect(requests[1].headers['X-CSRF-TOKEN']).toBe('n3w');
  });
});

const tokenResponse = (token, extra = {}) =>
  asyncResponse({
    jsmods: { define: [[CSRF_TOKEN_MODULE, { token, header: 'X-CSRF-TOKEN', refresh: '/csrf' }]] },
    ...extra
  });

function handlers() {
  return {
    initial: vi.fn(),
    success: vi.fn(),
    transportError: vi.fn(),
    finally: vi.fn()
  };
}

function send(request, h) {
  return request
    .setInitialHandler(h.initial)
    .setHandler(h.success)
    .setTransportErrorHandler(h.transportError)
    .setFinallyHandler(h.finally)
    .send();
}

describe('CSRF token refresh', () => {
  beforeEach(() => {
    defineToken({ token: 'old', header: 'X-CSRF-TOKEN', param: null, refresh: '/csrf' });
  });

  it('sends the request again with the token of a response that asks for it', () => {
    const h = handlers();
    send(new AsyncRequest('/save').setData({ title: 'Hi' }), h);

    requests[0].respond(200, tokenResponse('fresh', { csrf_refresh: 1 }));

    expect(requests).toHaveLength(2);
    expect(requests[1].url).toBe('/save');
    expect(requests[1].headers['X-CSRF-TOKEN']).toBe('fresh');
    expect(requests[1].body).toBe(requests[0].body);
    expect(h.success).not.toHaveBeenCalled();
    expect(h.finally).not.toHaveBeenCalled();

    requests[1].respond(200, asyncResponse({ payload: 'saved' }));

    expect(h.initial).toHaveBeenCalledOnce();
    expect(h.success).toHaveBeenCalledOnce();
    expect(h.success.mock.calls[0][0].payload).toBe('saved');
    expect(h.finally).toHaveBeenCalledOnce();
  });

  it('sends the new token as a field of the data too', () => {
    defineToken({ token: 'old', header: null, param: '_token' });

    new AsyncRequest('/save').setData({ title: 'Hi' }).send();
    requests[0].respond(
      200,
      asyncResponse({
        csrf_refresh: 1,
        jsmods: { define: [[CSRF_TOKEN_MODULE, { token: 'fresh', header: null, param: '_token' }]] }
      })
    );

    expect(requests[0].body).toContain('_token=old');
    expect(requests[1].body).toContain('_token=fresh');
    expect(requests[1].body).toContain('title=Hi');
  });

  it('asks only once, a second rejection is a response like any other', () => {
    const h = handlers();
    send(new AsyncRequest('/save'), h);

    requests[0].respond(200, tokenResponse('one', { csrf_refresh: 1 }));
    requests[1].respond(200, tokenResponse('two', { csrf_refresh: 1 }));

    expect(requests).toHaveLength(2);
    expect(h.success).toHaveBeenCalledOnce();
    expect(h.finally).toHaveBeenCalledOnce();
  });

  it('gets a new token from the refresh URL after a 419, then sends the request again', () => {
    const h = handlers();
    send(new AsyncRequest('/save').setMethod('POST'), h);

    requests[0].respond(419, 'Page Expired');
    expect(requests).toHaveLength(2);
    expect(requests[1].method).toBe('GET');
    expect(requests[1].url).toMatch(/^\/csrf\?__req=\d+$/);
    expect(h.transportError).not.toHaveBeenCalled();

    requests[1].respond(200, tokenResponse('fresh'));
    expect(requests).toHaveLength(3);
    expect(requests[2].url).toBe('/save');
    expect(requests[2].headers['X-CSRF-TOKEN']).toBe('fresh');

    requests[2].respond(200, asyncResponse({}));
    expect(h.success).toHaveBeenCalledOnce();
    expect(h.finally).toHaveBeenCalledOnce();
    expect(h.initial).toHaveBeenCalledOnce();
  });

  it('is an HTTP error when the request expires again', () => {
    const h = handlers();
    send(new AsyncRequest('/save'), h);

    requests[0].respond(419, 'Page Expired');
    requests[1].respond(200, tokenResponse('fresh'));
    requests[2].respond(419, 'Page Expired');

    expect(requests).toHaveLength(3);
    expect(h.transportError).toHaveBeenCalledOnce();
    expect(h.transportError.mock.calls[0][1].type).toBe(ERROR_TYPE.HTTP);
    expect(h.finally).toHaveBeenCalledOnce();
  });

  it('reports the 419 when the token can not be refreshed', () => {
    const h = handlers();
    send(new AsyncRequest('/save'), h);

    requests[0].respond(419, 'Page Expired');
    requests[1].respond(500, 'Error');

    expect(requests).toHaveLength(2);
    expect(h.transportError).toHaveBeenCalledOnce();
    expect(h.transportError.mock.calls[0][1].code).toBe(419);
    expect(h.finally).toHaveBeenCalledOnce();
  });

  it('is an HTTP error without a refresh URL, or with one of another origin', () => {
    defineToken({ token: 'old', header: 'X-CSRF-TOKEN' });
    const h = handlers();
    send(new AsyncRequest('/save'), h);
    requests[0].respond(419, 'Page Expired');

    defineToken({ token: 'old', header: 'X-CSRF-TOKEN', refresh: 'https://other.example/csrf' });
    const other = handlers();
    send(new AsyncRequest('/save'), other);
    requests[1].respond(419, 'Page Expired');

    expect(requests).toHaveLength(2);
    expect(h.transportError).toHaveBeenCalledOnce();
    expect(other.transportError).toHaveBeenCalledOnce();
  });

  it('does not send again a request that was abandoned meanwhile', () => {
    const request = new AsyncRequest('/save');
    const h = handlers();
    send(request, h);

    requests[0].respond(419, 'Page Expired');
    request.abandon();
    requests[1].respond(200, tokenResponse('fresh'));

    expect(requests).toHaveLength(2);
    expect(h.success).not.toHaveBeenCalled();
    expect(h.finally).toHaveBeenCalledOnce();
  });
});
