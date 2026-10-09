import requireModule, { isModuleDefined } from './requireModule';

export const CSP_NONCE_MODULE = 'CSPNonce';

/**
 * Returns the Content Security Policy nonce of the page: the CSPNonce module the server defines, or
 * the nonce of the first script that has one. Browsers hide the attribute value of a nonce once the
 * page is loaded, but keep it in the `nonce` property.
 */
export default function getCSPNonce() {
  if (isModuleDefined(CSP_NONCE_MODULE)) {
    const nonce = requireModule(CSP_NONCE_MODULE);
    if (nonce) {
      return nonce;
    }
  }

  const script = document.querySelector('script[nonce]');

  if (!script) {
    return null;
  }

  return script.nonce || script.getAttribute('nonce') || null;
}
