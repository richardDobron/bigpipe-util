import { beforeEach, describe, expect, it, vi } from 'vitest';
import BigPipe, { BIGPIPE_PHASE, PAGELET_PHASE } from '../BigPipe';
import Pagelet from '../Pagelet';

beforeEach(() => {
  document.body.innerHTML = '<div id="slot">old</div>';
});

describe('BigPipe', () => {
  it('is a singleton', () => {
    expect(new BigPipe()).toBe(new BigPipe());
  });

  it('creates and registers a pagelet without a CommonJS require', () => {
    const bigPipe = new BigPipe();

    bigPipe.onPageletArrive({
      id: 'main',
      css: [],
      js: [],
      domops: [['setContent', '#slot', false, { __html: '<b>new</b>' }]],
      jsmods: { require: [] },
      is_last: true
    });

    const pagelet = bigPipe.pagelets.get('main');
    expect(pagelet).toBeInstanceOf(Pagelet);
    expect(pagelet.bigPipe).toBe(bigPipe);
    expect(pagelet.phase).toBe(PAGELET_PHASE.ARRIVE_END);
    expect(document.getElementById('slot').innerHTML).toBe('<b>new</b>');
    expect(bigPipe.phase).toBe(BIGPIPE_PHASE.READY_FOR_JS);
  });

  it('still exports the phases for existing imports', async () => {
    const phases = await import('../BigPipePhases');

    expect(BIGPIPE_PHASE).toBe(phases.BIGPIPE_PHASE);
    expect(PAGELET_PHASE).toBe(phases.PAGELET_PHASE);
  });
});

describe('resources', () => {
  function arriveWithCss(bigPipe, id, css) {
    bigPipe.onPageletArrive({ id, css, js: [], domops: [], jsmods: { require: [] } });
  }

  it('loads files with the same name from different paths', () => {
    document.head.innerHTML = '';
    const bigPipe = new BigPipe();

    arriveWithCss(bigPipe, 'feed', ['/feed/main.css']);
    arriveWithCss(bigPipe, 'chat', ['/chat/main.css']);

    expect(
      Array.from(document.querySelectorAll('link'), link => link.getAttribute('href'))
    ).toEqual(['/feed/main.css', '/chat/main.css']);
  });

  it('loads the same file only once, also when written differently', () => {
    document.head.innerHTML = '';
    const bigPipe = new BigPipe();

    arriveWithCss(bigPipe, 'header', ['/shared/base.css']);
    arriveWithCss(bigPipe, 'footer', [window.location.origin + '/shared/base.css']);

    expect(document.querySelectorAll('link')).toHaveLength(1);
  });
});

describe('errors', () => {
  it('finishes a pagelet whose module calls fail', () => {
    vi.useFakeTimers();
    const init = vi.fn();
    window.require = name => (name === 'Widget' ? { init } : {});
    const bigPipe = new BigPipe();

    bigPipe.onPageletArrive({
      id: 'failing',
      css: [],
      js: [],
      domops: [],
      jsmods: {
        require: [
          ['Broken', 'init'],
          ['Widget', 'init']
        ]
      }
    });

    expect(bigPipe.pagelets.get('failing').phase).toBe(PAGELET_PHASE.ARRIVE_END);
    expect(init).toHaveBeenCalledOnce();
    expect(() => vi.runAllTimers()).toThrow('Module Broken has no method "init"');

    delete window.require;
    vi.useRealTimers();
  });
});

describe('Pagelet', () => {
  it('requires the BigPipe that received it', () => {
    expect(() => new Pagelet({ id: 'orphan' })).toThrow(
      'Pagelet "orphan" has to be created by BigPipe.onPageletArrive().'
    );
  });
});
