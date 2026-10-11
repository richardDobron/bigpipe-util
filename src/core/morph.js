/**
 * DOM morphing adapted from @alpinejs/morph 3.17.4 (packages/morph/src/morph.js), the algorithm
 * Alpine and Livewire morph with. Trimmed to what BigPipe uses: no hooks, lookahead or Alpine
 * integration, no morphBetween() or Livewire block markers, and no global patch of
 * Element.prototype.setAttribute.
 *
 * MIT License
 *
 * Copyright © 2019-2025 Caleb Porzio and contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { trustedHTML } from './trustedTypes';

/**
 * Updates `from` to match the element `to`, keeping the nodes that stay. Children are matched by
 * the key that `key(element)` returns, or else by their position and tag.
 */
export function morph(from, to, key) {
  const getKey = el => el && el.nodeType === 1 && key(el);

  function patch(from, to) {
    if (
      from.nodeType != to.nodeType ||
      from.nodeName != to.nodeName ||
      getKey(from) != getKey(to)
    ) {
      from.replaceWith(to.cloneNode(true));
      return;
    }

    if (to.nodeType === 3 || to.nodeType === 8) {
      if (from.nodeValue !== to.nodeValue) {
        from.nodeValue = to.nodeValue;
      }
      return;
    }

    patchAttributes(from, to);
    patchChildren(from, to);
  }

  function patchChildren(from, to) {
    const fromKeys = {};
    for (const el of from.children) {
      const elKey = getKey(el);
      if (elKey) {
        fromKeys[elKey] = el;
      }
    }

    const fromKeyHoldovers = {};

    let currentTo = to.firstChild;
    let currentFrom = from.firstChild;

    while (currentTo) {
      const toKey = getKey(currentTo);
      let fromKey = getKey(currentFrom);

      // Add new elements...
      if (!currentFrom) {
        if (toKey && fromKeyHoldovers[toKey]) {
          const holdover = fromKeyHoldovers[toKey];

          from.appendChild(holdover);

          currentFrom = holdover;
          fromKey = getKey(currentFrom);
        } else {
          from.appendChild(currentTo.cloneNode(true));

          currentTo = currentTo.nextSibling;

          continue;
        }
      }

      if (toKey !== fromKey) {
        if (!toKey && fromKey) {
          // No "to" key...
          fromKeyHoldovers[fromKey] = currentFrom;
          currentFrom = addNodeBefore(from, currentTo, currentFrom);
          fromKeyHoldovers[fromKey].remove();
          currentFrom = currentFrom.nextSibling;
          currentTo = currentTo.nextSibling;

          continue;
        }

        if (toKey && !fromKey && fromKeys[toKey]) {
          // No "from" key...
          currentFrom.replaceWith(fromKeys[toKey]);
          currentFrom = fromKeys[toKey];
          fromKey = getKey(currentFrom);
        }

        if (toKey && fromKey) {
          const fromKeyNode = fromKeys[toKey];

          if (fromKeyNode) {
            // Move "from" key...
            fromKeyHoldovers[fromKey] = currentFrom;
            currentFrom.replaceWith(fromKeyNode);
            currentFrom = fromKeyNode;
            fromKey = getKey(currentFrom);
          } else {
            // Swap elements with keys...
            fromKeyHoldovers[fromKey] = currentFrom;
            currentFrom = addNodeBefore(from, currentTo, currentFrom);
            fromKeyHoldovers[fromKey].remove();
            currentFrom = currentFrom.nextSibling;
            currentTo = currentTo.nextSibling;

            continue;
          }
        }
      }

      // Get the next "from" sibling before patching, in case the node is replaced.
      const currentFromNext = currentFrom.nextSibling;

      patch(currentFrom, currentTo);

      currentTo = currentTo.nextSibling;
      currentFrom = currentFromNext;
    }

    // Collect the removals first, so removing doesn't change the order.
    const removals = [];

    while (currentFrom) {
      removals.push(currentFrom);
      currentFrom = currentFrom.nextSibling;
    }

    removals.forEach(node => node.remove());
  }

  patch(from, to);

  return from;
}

function patchAttributes(from, to) {
  for (const { name } of Array.from(from.attributes)) {
    if (!to.hasAttribute(name)) {
      if (name === 'open' && from.nodeName === 'DIALOG' && from.open) {
        from.close();
      } else {
        from.removeAttribute(name);
      }
    }
  }

  for (const { name, value } of Array.from(to.attributes)) {
    if (from.getAttribute(name) !== value) {
      setAttribute(from, name, value);
    }
  }
}

function addNodeBefore(parent, node, beforeMe) {
  const clone = node.cloneNode(true);

  parent.insertBefore(clone, beforeMe);

  return clone;
}

let attributeHost = null;

// setAttribute() rejects names with "@" like Alpine's @click, the HTML parser accepts them.
function setAttribute(el, name, value) {
  if (!name.includes('@')) {
    el.setAttribute(name, value);
    return;
  }

  attributeHost = attributeHost || document.createElement('div');

  const escapedValue = value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

  attributeHost.innerHTML = trustedHTML(`<span ${name}="${escapedValue}"></span>`);

  const attr = attributeHost.firstElementChild.getAttributeNode(name);

  attributeHost.firstElementChild.removeAttributeNode(attr);

  el.setAttributeNode(attr);
}
