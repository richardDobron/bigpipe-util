import { morph } from './morph';
import { trustedHTML } from './trustedTypes';

function removeNode(node) {
  if (node.parentNode) {
    node.parentNode.removeChild(node);
  }
}

const morphKey = el => el.getAttribute('key') || el.id || null;

function createSingleElement(content) {
  const template = document.createElement('template');
  template.innerHTML = trustedHTML(content);
  const { children, childNodes } = template.content;
  const hasText = Array.from(childNodes).some(
    child => child.nodeType === Node.TEXT_NODE && child.textContent.trim() !== ''
  );

  return children.length === 1 && !hasText ? children[0] : null;
}

export default {
  prependContent(node, content) {
    node.insertAdjacentHTML('afterbegin', trustedHTML(content));
  },

  insertAfter(node, content) {
    node.insertAdjacentHTML('afterend', trustedHTML(content));
  },

  insertBefore(node, content) {
    node.insertAdjacentHTML('beforebegin', trustedHTML(content));
  },

  setContent(node, content) {
    node.innerHTML = trustedHTML(content);
  },

  appendContent(node, content) {
    node.insertAdjacentHTML('beforeend', trustedHTML(content));
  },

  replace(node, content) {
    node.outerHTML = trustedHTML(content);
  },

  morph(node, content) {
    const element = createSingleElement(content);

    if (!element) {
      node.outerHTML = trustedHTML(content);
      return;
    }

    morph(node, element, morphKey);
  },

  morphContent(node, content) {
    const element = node.cloneNode(false);
    element.innerHTML = trustedHTML(content);

    morph(node, element, morphKey);
  },

  remove(node) {
    removeNode(node);
  },

  empty(node) {
    while (node.firstChild) {
      removeNode(node.firstChild);
    }
  }
};
