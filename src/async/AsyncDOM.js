import DOM from '../core/DOM';
import { trustedScript } from '../core/trustedTypes';
import warning from '../core/warning';

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
          DOM.setContent(node, content.__html);
          break;
        case 'appendContent':
          DOM.appendContent(node, content.__html);
          break;
        case 'prependContent':
          DOM.prependContent(node, content.__html);
          break;
        case 'insertAfter':
          DOM.insertAfter(node, content.__html);
          break;
        case 'insertBefore':
          DOM.insertBefore(node, content.__html);
          break;
        case 'remove':
          DOM.remove(node);
          break;
        case 'replace':
          DOM.replace(node, content.__html);
          break;
        case 'morph':
          DOM.morph(node, content.__html);
          break;
        case 'morphContent':
          DOM.morphContent(node, content.__html);
          break;
      }
    }
  }
}
