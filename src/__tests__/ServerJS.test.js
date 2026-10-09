import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ServerJS from '../ServerJS';

let created;
let modules;

class Chart {
  constructor(element, data) {
    created.push(this);
    this.element = element;
    this.data = data;
    this.render = vi.fn();
  }
}

beforeEach(() => {
  created = [];
  modules = {
    Chart,
    Dashboard: { add: vi.fn() },
    Settings: { theme: 'dark' }
  };
  window.require = name => modules[name];
  document.body.innerHTML = '<div id="chart"></div>';
});

afterEach(() => {
  delete window.require;
});

function handle(jsmods) {
  new ServerJS().handle(jsmods);
}

describe('instances', () => {
  it('creates the instance once and shares it between calls and module markers', () => {
    handle({
      instances: [['__inst_shared', 'Chart', [{ __e: 'chart' }, { points: [1, 2] }]]],
      require: [
        ['__inst_shared', 'render', ['fast']],
        ['Dashboard', 'add', [{ __m: '__inst_shared' }]]
      ]
    });

    expect(created).toHaveLength(1);
    const [chart] = created;
    expect(chart.element).toBe(document.getElementById('chart'));
    expect(chart.data).toEqual({ points: [1, 2] });
    expect(chart.render).toHaveBeenCalledWith('fast');
    expect(modules.Dashboard.add).toHaveBeenCalledWith(chart);
  });

  it('creates the instance only when something requires it', () => {
    handle({ instances: [['__inst_unused', 'Chart', []]] });
    expect(created).toHaveLength(0);

    handle({ require: [['__inst_unused']] });
    expect(created).toHaveLength(1);
  });

  it('keeps the instance for later responses', () => {
    handle({ instances: [['__inst_later', 'Chart', []]], require: [['__inst_later', 'render']] });
    handle({ require: [['__inst_later', 'render', ['again']]] });

    expect(created).toHaveLength(1);
    expect(created[0].render).toHaveBeenLastCalledWith('again');
  });

  it('rejects an instance defined twice', () => {
    handle({ instances: [['__inst_twice', 'Chart', []]] });

    expect(() => handle({ instances: [['__inst_twice', 'Chart', []]] })).toThrow(
      'BigPipe: instance "__inst_twice" is already defined.'
    );
  });

  it('explains when the module is not a class', () => {
    handle({ instances: [['__inst_object', 'Settings', []]] });

    expect(() => handle({ require: [['__inst_object']] })).toThrow(
      'BigPipe: instance "__inst_object" needs a class, module "Settings" is not one.'
    );
  });

  it('detects an instance that requires itself', () => {
    handle({ instances: [['__inst_loop', 'Chart', [{ __m: '__inst_loop' }]]] });

    expect(() => handle({ require: [['__inst_loop']] })).toThrow(
      'BigPipe: instance "__inst_loop" requires itself.'
    );
  });
});
