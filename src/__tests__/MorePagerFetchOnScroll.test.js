import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import BigPipe from '../BigPipe';
import MorePagerFetchOnScroll from '../MorePagerFetchOnScroll';
import Primer from '../Primer';
import ServerJS from '../ServerJS';
import '../ModuleRegistry';
import { asyncResponse, installFakeXHR } from '../__testutils__/fakeXHR';

let observers;
let requests;

class FakeIntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.elements = [];
    this.disconnected = false;
    observers.push(this);
  }

  observe(element) {
    this.elements.push(element);
  }

  disconnect() {
    this.disconnected = true;
  }

  show() {
    this.callback(this.elements.map(target => ({ target, isIntersecting: true })));
  }
}

beforeAll(() => {
  Primer();
});

beforeEach(() => {
  observers = [];
  requests = installFakeXHR();
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  document.body.innerHTML =
    '<ul class="posts"><li>1</li></ul>' +
    '<a id="pager" href="/feed?page=2" ajaxify="/feed?page=2" rel="async">See more</a>';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MorePagerFetchOnScroll', () => {
  it('clicks the pager when it comes within the offset of the viewport', () => {
    const pager = document.getElementById('pager');
    const click = vi.spyOn(pager, 'click');

    new MorePagerFetchOnScroll(pager, 300);
    expect(observers[0].options).toEqual({ rootMargin: '300px' });
    expect(click).not.toHaveBeenCalled();

    observers[0].show();
    expect(click).toHaveBeenCalledOnce();
  });

  it('waits for setup() when created without it, and stops when removed', () => {
    const pager = document.getElementById('pager');

    const morePager = new MorePagerFetchOnScroll(pager, 0, false);
    expect(observers).toHaveLength(0);

    morePager.setup();
    morePager.remove();
    expect(observers[0].disconnected).toBe(true);
  });

  it('stops when the pagelet it is in is destroyed', () => {
    const bigPipe = new BigPipe();
    document.body.innerHTML = '<div id="pagelet_list"></div>';
    bigPipe.onPageletArrive({
      id: 'list',
      css: [],
      js: [],
      domops: [['setContent', '#pagelet_list', false, { __html: '<a id="pager">See more</a>' }]],
      jsmods: {},
      is_last: true
    });

    new MorePagerFetchOnScroll(document.getElementById('pager'));
    bigPipe.removePagelet(bigPipe.pagelets.get('list'));

    expect(observers[0].disconnected).toBe(true);
  });

  it('is created by the server and loads the next page through the Primer', () => {
    new ServerJS().handle({
      require: [['bigpipe-util/dist/MorePagerFetchOnScroll', null, [{ __e: 'pager' }, 300]]]
    });

    observers[0].show();

    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('GET');
    expect(requests[0].url).toMatch(/^\/feed\?page=2&__req=\d+$/);

    requests[0].respond(
      200,
      asyncResponse({
        domops: [
          ['appendContent', 'ul.posts', false, { __html: '<li>2</li>' }],
          ['replace', '', true, { __html: '' }]
        ]
      })
    );

    expect(document.querySelector('ul.posts').innerHTML).toBe('<li>1</li><li>2</li>');
    expect(document.getElementById('pager')).toBeNull();
  });
});
