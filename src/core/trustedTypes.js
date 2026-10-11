import warning from './warning';

/**
 * The name of the Trusted Types policy BigPipe inserts the HTML, scripts and code of the server
 * with. A Content Security Policy that requires Trusted Types allows it: `trusted-types bigpipe`.
 */
export const POLICY_NAME = 'bigpipe';

// The HTML and the code come from the server of the page, like the page itself: they pass as they are.
const pass = value => value;

let policy;

function getPolicy() {
  if (policy !== undefined) {
    return policy;
  }

  policy = null;
  const factory = typeof window !== 'undefined' ? window.trustedTypes : undefined;

  if (factory && typeof factory.createPolicy === 'function') {
    try {
      policy = factory.createPolicy(POLICY_NAME, {
        createHTML: pass,
        createScript: pass,
        createScriptURL: pass
      });
    } catch (error) {
      // The Content Security Policy does not allow the policy, or it exists already.
      warning(
        false,
        'BigPipe: the Trusted Types policy "%s" can not be created: %s',
        POLICY_NAME,
        error
      );
    }
  }

  return policy;
}

/**
 * The HTML of the server for innerHTML, outerHTML and insertAdjacentHTML: a TrustedHTML when the
 * browser supports Trusted Types, the string otherwise.
 */
export function trustedHTML(html) {
  const current = getPolicy();
  return current ? current.createHTML(html) : html;
}

/**
 * The code of the server for the Function constructor, see the deprecated eval DOM operation.
 */
export function trustedScript(code) {
  const current = getPolicy();
  return current ? current.createScript(code) : code;
}

/**
 * The URL of a script the Bootloader loads.
 */
export function trustedScriptURL(url) {
  const current = getPolicy();
  return current ? current.createScriptURL(url) : url;
}
