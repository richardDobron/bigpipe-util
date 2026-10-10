/**
 * Loads the URL in full, replacing the current history entry when `replace` is true.
 */
export default function goOrReplace(location, uri, replace = false) {
  if (replace) {
    location.replace(uri);
  } else {
    location.assign(uri);
  }
}
