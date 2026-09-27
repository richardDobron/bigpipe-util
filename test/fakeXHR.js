import { vi } from 'vitest';

export const SHIELD = 'for (;;);';

export function asyncResponse(response) {
  return SHIELD + JSON.stringify(response);
}

export function installFakeXHR() {
  const requests = [];

  class FakeXMLHttpRequest {
    constructor() {
      this.headers = {};
      this.aborted = false;
      requests.push(this);
    }

    open(method, url) {
      this.method = method;
      this.url = url;
    }

    setRequestHeader(name, value) {
      this.headers[name] = value;
    }

    send(body) {
      this.body = body;
    }

    abort() {
      this.aborted = true;
      this.onabort && this.onabort.call(this);
    }

    respond(status, responseText) {
      this.status = status;
      this.responseText = responseText;
      this.onload.call(this);
    }

    fail() {
      this.onerror.call(this);
    }
  }

  vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest);

  return requests;
}
