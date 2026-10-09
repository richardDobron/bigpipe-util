import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncRequest, { CSRF_TOKEN_MODULE } from '../AsyncRequest';
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
