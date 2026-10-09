/**
 * Throws when `condition` is falsy. Use it for states the code cannot recover from, so the
 * message explains what went wrong instead of failing later with an unrelated TypeError.
 *
 *   invariant(node, 'Element "%s" does not exist.', id);
 *
 * Every `%s` in `format` is replaced by the next argument.
 */
export default function invariant(condition, format, ...args) {
  if (condition) {
    return;
  }

  let index = 0;
  const error = new Error(format.replace(/%s/g, () => String(args[index++])));
  error.name = 'Invariant Violation';
  throw error;
}
