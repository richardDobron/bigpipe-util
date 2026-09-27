import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Primer from '../src/Primer';
import { asyncResponse, installFakeXHR } from './fakeXHR';

let requests;

beforeAll(() => {
  Primer();
});

beforeEach(() => {
  requests = installFakeXHR();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function click(element) {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function submit(form, submitter) {
  const event = new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter });
  form.dispatchEvent(event);
  return event;
}

describe('links', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <a id="get" href="#" ajaxify="/ajax/remove.php?id=1" rel="async"><span>Remove</span></a>
      <a id="post" href="#" ajaxify="/ajax/like.php" rel="async-post">Like</a>
      <a id="dialog" href="#" ajaxify="/ajax/dialog.php" rel="dialog">Open</a>`;
  });

  it.each([
    ['get', 'GET', /^\/ajax\/remove\.php\?id=1&__req=\d+$/],
    ['post', 'POST', /^\/ajax\/like\.php$/],
    ['dialog', 'POST', /^\/ajax\/dialog\.php$/]
  ])('sends a request for the rel of #%s', (id, method, url) => {
    click(document.getElementById(id));

    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe(method);
    expect(requests[0].url).toMatch(url);
  });

  it('handles clicks on the children of the link', () => {
    click(document.querySelector('#get span'));

    expect(requests).toHaveLength(1);
  });

  it('marks the link while the request is running and ignores further clicks', () => {
    const link = document.getElementById('get');

    click(link);
    expect(link.classList.contains('async-saving')).toBe(true);

    click(link);
    expect(requests).toHaveLength(1);

    requests[0].respond(200, asyncResponse({}));
    expect(link.classList.contains('async-saving')).toBe(false);
  });

  it('unmarks the link when the response is not valid', () => {
    vi.useFakeTimers();
    const link = document.getElementById('get');

    click(link);
    requests[0].respond(200, 'Fatal error');

    expect(link.classList.contains('async-saving')).toBe(false);
    expect(() => vi.runAllTimers()).toThrow(/Failed to handle response/);
  });
});

describe('forms', () => {
  let form;

  beforeEach(() => {
    document.body.innerHTML = `
      <form action="/ajax/subscribe.php" method="POST" rel="async">
        <input name="email" value="jo@example.com">
        <span class="form-loader"></span>
        <button type="submit" name="plan" value="free">Subscribe</button>
      </form>`;
    form = document.querySelector('form');
  });

  it('submits the form data with the submitter', () => {
    const event = submit(form, form.querySelector('button'));

    expect(event.defaultPrevented).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('POST');
    expect(requests[0].url).toBe('/ajax/subscribe.php');
    expect(requests[0].body.get('email')).toBe('jo@example.com');
    expect(requests[0].body.get('plan')).toBe('free');
  });

  it('submits the data of GET forms in the query string', () => {
    form.setAttribute('method', 'GET');
    submit(form, form.querySelector('button'));

    expect(requests[0].method).toBe('GET');
    expect(requests[0].url).toMatch(
      /^\/ajax\/subscribe\.php\?email=jo%40example\.com&plan=free&__req=\d+$/
    );
  });

  it.each([
    ['a valid response', xhr => xhr.respond(200, asyncResponse({}))],
    ['an error status', xhr => xhr.respond(500, '')],
    ['a network error', xhr => xhr.fail()]
  ])('locks the form while the request is running and unlocks it after %s', (_, finish) => {
    const input = form.querySelector('input');
    const button = form.querySelector('button');

    submit(form, button);

    expect(form.classList.contains('async-saving')).toBe(true);
    expect(input.hasAttribute('readonly')).toBe(true);
    expect(button.disabled).toBe(true);

    finish(requests[0]);

    expect(form.classList.contains('async-saving')).toBe(false);
    expect(input.hasAttribute('readonly')).toBe(false);
    expect(button.disabled).toBe(false);
  });

  it('shows the loader while the request is running', () => {
    submit(form, form.querySelector('button'));

    expect(form.querySelector('.form-loader').classList.contains('loading')).toBe(true);
  });

  it('hides the loader after the request', () => {
    submit(form, form.querySelector('button'));
    requests[0].respond(200, asyncResponse({}));

    expect(form.querySelector('.form-loader').classList.contains('loading')).toBe(false);
  });

  it('ignores forms without rel="async"', () => {
    form.removeAttribute('rel');
    form.addEventListener('submit', event => event.preventDefault());

    submit(form, form.querySelector('button'));

    expect(requests).toHaveLength(0);
  });
});
