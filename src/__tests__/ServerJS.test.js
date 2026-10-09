import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ServerJS from '../ServerJS';
import requireModule from '../core/requireModule';

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

function reportedError(callback) {
  vi.useFakeTimers();
  try {
    expect(callback).not.toThrow();
    vi.runAllTimers();
  } catch (error) {
    return error.message;
  } finally {
    vi.useRealTimers();
  }
  return null;
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

    expect(reportedError(() => handle({ instances: [['__inst_twice', 'Chart', []]] }))).toBe(
      'BigPipe: instance "__inst_twice" is already defined.'
    );
  });

  it('explains when the module is not a class', () => {
    handle({ instances: [['__inst_object', 'Settings', []]] });

    expect(reportedError(() => handle({ require: [['__inst_object']] }))).toBe(
      'BigPipe: instance "__inst_object" needs a class, module "Settings" is not one.'
    );
  });

  it('detects an instance that requires itself', () => {
    handle({ instances: [['__inst_loop', 'Chart', [{ __m: '__inst_loop' }]]] });

    expect(reportedError(() => handle({ require: [['__inst_loop']] }))).toBe(
      'BigPipe: instance "__inst_loop" requires itself.'
    );
  });
});

describe('errors', () => {
  it('reports a failing call and still runs the others', () => {
    vi.useFakeTimers();

    handle({
      require: [
        ['Dashboard', 'missing'],
        ['Missing', 'init'],
        ['Dashboard', 'add', ['still called']]
      ]
    });

    expect(modules.Dashboard.add).toHaveBeenCalledWith('still called');
    expect(() => vi.runAllTimers()).toThrow('Module Dashboard has no method "missing"');
    vi.useRealTimers();
  });

  it('still runs the calls when a define or an instance fails', () => {
    vi.useFakeTimers();
    handle({ instances: [['__inst_failing', 'Chart', []]] });

    handle({
      instances: [['__inst_failing', 'Chart', []]],
      require: [['Dashboard', 'add', ['after the failure']]]
    });

    expect(modules.Dashboard.add).toHaveBeenCalledWith('after the failure');
    expect(() => vi.runAllTimers()).toThrow('already defined');
    vi.useRealTimers();
  });
});

describe('define', () => {
  it('defines a module the server sends', () => {
    handle({ define: [['SiteData', { locale: 'sk_SK', user: { id: 7 } }]] });

    expect(requireModule('SiteData')).toEqual({ locale: 'sk_SK', user: { id: 7 } });
  });

  it('passes a defined module to calls and module markers', () => {
    handle({
      define: [['DashboardConfig', { columns: 3 }]],
      require: [['Dashboard', 'add', [{ __m: 'DashboardConfig' }]]]
    });

    expect(modules.Dashboard.add).toHaveBeenCalledWith({ columns: 3 });
  });

  it('replaces the markers of the exports when the module is first required', () => {
    handle({
      define: [
        ['ChartConfig', { container: { __e: 'chart' }, chart: { __m: '__inst_config' } }],
        ['ChartContainer', { __e: 'chart' }]
      ],
      instances: [['__inst_config', 'Chart', []]]
    });
    expect(created).toHaveLength(0);

    const config = requireModule('ChartConfig');
    expect(config.container).toBe(document.getElementById('chart'));
    expect(config.chart).toBe(created[0]);
    expect(requireModule('ChartContainer')).toBe(document.getElementById('chart'));
  });

  it('replaces a module defined again, e.g. by a later response', () => {
    handle({ define: [['TokenData', { token: 'first' }]] });
    expect(requireModule('TokenData').token).toBe('first');

    handle({ define: [['TokenData', { token: 'second' }]] });
    expect(requireModule('TokenData').token).toBe('second');
  });
});
