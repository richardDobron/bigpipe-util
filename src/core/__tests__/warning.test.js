import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import warning from '../warning';

let consoleError;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  consoleError.mockRestore();
});

describe('warning', () => {
  it('logs the formatted message in development', () => {
    vi.stubGlobal('__DEV__', true);

    warning(false, "Selector '%s' does not match anything!", '#missing');

    expect(consoleError).toHaveBeenCalledWith(
      "Warning: Selector '#missing' does not match anything!"
    );
  });

  it('stays silent when the condition holds', () => {
    vi.stubGlobal('__DEV__', true);

    warning(true, 'never');

    expect(consoleError).not.toHaveBeenCalled();
  });

  it('stays silent outside of development', () => {
    warning(false, 'without __DEV__');
    vi.stubGlobal('__DEV__', false);
    warning(false, 'with __DEV__ disabled');

    expect(consoleError).not.toHaveBeenCalled();
  });
});
