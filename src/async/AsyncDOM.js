import DOM from '../core/DOM';
import { trustedScript } from '../core/trustedTypes';
import warning from '../core/warning';

/**
 * The HTML of a container the page printed before the script of a pagelet, see the __container
 * marker: a hidden <code> element with the HTML in a comment, where `\` and `-` are escaped
 * with a backslash, so the HTML is not escaped in JSON and is not parsed until it is inserted.
 */
function takeContainer(id) {
  const container = document.getElementById(id);
  warning(container, "BigPipe: the HTML container '%s' is not on the page.", id);

  if (!container) {
    return '';
  }

  const comment = container.firstChild;
  container.remove();

  if (!comment || comment.nodeType !== Node.COMMENT_NODE) {
    return '';
  }

  return comment.nodeValue.slice(1, -1).replace(/\\([\s\S])/g, '$1');
}

// The HTML of a DOM operation: {__html} in the JSON, or {__container} in the page.
function markup(content) {
  if (content && typeof content.__container === 'string') {
    return takeContainer(content.__container);
  }

  return content.__html;
}

export default class AsyncDOM {
  invoke(domOps, element) {
    for (let i = 0; i < domOps.length; ++i) {
      let [type, selector, enableTarget, content] = domOps[i];

      let node = (enableTarget && element) || null;

      if (selector) {
        node = (node || document.documentElement).querySelector(selector);
      }

      warning(node, "Selector '%s' does not match anything!", selector);

      if (!node) {
        continue;
      }

      switch (type) {
        case 'eval':
          warning(
            false,
            'The eval DOM operation is deprecated: a Content Security Policy without ' +
              "'unsafe-eval' blocks it. Call a module with jsmods instead."
          );
          new Function(trustedScript(content)).apply(node);
          break;
        case 'hide':
          node.style.display = 'none';
          break;
        case 'show':
          node.style.display = '';
          break;
        case 'setContent':
          DOM.setContent(node, markup(content));
          break;
        case 'appendContent':
          DOM.appendContent(node, markup(content));
          break;
        case 'prependContent':
          DOM.prependContent(node, markup(content));
          break;
        case 'insertAfter':
          DOM.insertAfter(node, markup(content));
          break;
        case 'insertBefore':
          DOM.insertBefore(node, markup(content));
          break;
        case 'remove':
          DOM.remove(node);
          break;
        case 'replace':
          DOM.replace(node, markup(content));
          break;
        case 'morph':
          DOM.morph(node, markup(content));
          break;
        case 'morphContent':
          DOM.morphContent(node, markup(content));
          break;
      }
    }
  }
}
