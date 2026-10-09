import { morph } from './morph';

function removeNode(node) {
  if (node.parentNode) {
    node.parentNode.removeChild(node);
  }
}

const morphKey = el => el.getAttribute('key') || el.id || null;

function createSingleElement(content) {
  const template = document.createElement('template');
  template.innerHTML = content;
  const { children, childNodes } = template.content;
  const hasText = Array.from(childNodes).some(
    child => child.nodeType === Node.TEXT_NODE && child.textContent.trim() !== ''
  );

  return children.length === 1 && !hasText ? children[0] : null;
}

export default {
  prependContent(node, content) {
    node.insertAdjacentHTML('afterbegin', content);
  },

  insertAfter(node, content) {
    node.insertAdjacentHTML('afterend', content);
  },

  insertBefore(node, content) {
    node.insertAdjacentHTML('beforebegin', content);
  },

  setContent(node, content) {
    node.innerHTML = content;
  },

  appendContent(node, content) {
    node.insertAdjacentHTML('beforeend', content);
  },

  replace(node, content) {
    node.outerHTML = content;
  },

  morph(node, content) {
    const element = createSingleElement(content);

    if (!element) {
      node.outerHTML = content;
      return;
    }

    morph(node, element, morphKey);
  },

  morphContent(node, content) {
    const element = node.cloneNode(false);
    element.innerHTML = content;

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
