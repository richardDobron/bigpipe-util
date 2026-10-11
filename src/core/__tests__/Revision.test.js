import { beforeEach, describe, expect, it, vi } from 'vitest';

let AsyncResponse;
let ServerJS;
let Arbiter;
let isOutdated;

// The revision of the page is kept: every test gets fresh modules.
beforeEach(async () => {
  vi.resetModules();
  ({ default: AsyncResponse } = await import('../../async/AsyncResponse'));
  ({ default: ServerJS } = await import('../../ServerJS'));
  ({ default: Arbiter } = await import('../Arbiter'));
  ({ isOutdated } = await import('../Revision'));
});

const definePageRevision = revision =>
  new ServerJS().handle({ define: [['BigPipeRevision', revision]] });

describe('Revision', () => {
  it('informs once that a response comes from a newer deploy than the page', () => {
    const informed = vi.fn();
    new Arbiter().subscribe('BigPipe/newRevision', informed);
    definePageRevision('r1');

    new AsyncResponse().handle({ revision: 'r1' });
    expect(informed).not.toHaveBeenCalled();
    expect(isOutdated()).toBe(false);

    new AsyncResponse().handle({ revision: 'r2' });
    new AsyncResponse().handle({ revision: 'r3' });

    expect(informed).toHaveBeenCalledOnce();
    expect(informed.mock.calls[0][0]).toEqual({ revision: 'r2', page: 'r1' });
    expect(isOutdated()).toBe(true);
  });

  it('compares nothing without the revision of the page or of the response', () => {
    new AsyncResponse().handle({ revision: 'r2' });
    definePageRevision('r1');
    new AsyncResponse().handle({});

    expect(isOutdated()).toBe(false);
  });
});
