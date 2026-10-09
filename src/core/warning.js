/**
 * Logs `format` to the console when `condition` is falsy and `__DEV__` is enabled. Unlike
 * `invariant`, it does not throw: use it for mistakes the code can recover from.
 *
 *   warning(node, 'Selector "%s" does not match anything!', selector);
 *
 * Every `%s` in `format` is replaced by the next argument.
 */
export default function warning(condition, format, ...args) {
  if (condition || typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }

  let index = 0;
  console.error('Warning: ' + format.replace(/%s/g, () => String(args[index++])));
}
