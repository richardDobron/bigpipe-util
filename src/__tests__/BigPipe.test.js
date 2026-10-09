import { beforeEach, describe, expect, it } from 'vitest';
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

describe('Pagelet', () => {
  it('requires the BigPipe that received it', () => {
    expect(() => new Pagelet({ id: 'orphan' })).toThrow(
      'Pagelet "orphan" has to be created by BigPipe.onPageletArrive().'
    );
  });
});
