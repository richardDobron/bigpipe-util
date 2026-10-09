/**
 * Returns the Content Security Policy nonce of the page, taken from the first script that has one,
 * so the scripts and stylesheets BigPipe adds are allowed as well. Browsers hide the attribute value
 * of a nonce once the page is loaded, but keep it in the `nonce` property.
 */
export default function getCSPNonce() {
  const script = document.querySelector('script[nonce]');

  if (!script) {
    return null;
  }

  return script.nonce || script.getAttribute('nonce') || null;
}
