// The modal layers and the dialogs share one stacking order: the one shown last is on top, with
// the only visible backdrop right below it.
const entries = [];

/**
 * Restacks the entries: each one gets its own `zIndex`, or 10 above the one below when that is
 * higher. The backdrop gets the z-index, the root 1 more.
 */
export function updateStack() {
  let zIndex = -Infinity;
  let backdrop = null;

  entries.forEach(entry => {
    zIndex = Math.max(entry.zIndex, zIndex + 10);
    entry.root.style.zIndex = String(zIndex + 1);

    const element = entry.getBackdrop();
    if (element) {
      element.style.zIndex = String(zIndex);
      element.style.display = 'none';
      backdrop = element;
    }
  });

  if (backdrop) {
    backdrop.style.zIndex = String(zIndex);
    backdrop.style.display = '';
  }
}

/**
 * Puts an entry on top: `{ zIndex, root, getBackdrop() }`, where zIndex is the lowest one it
 * takes and getBackdrop() returns its backdrop or null.
 */
export function addToStack(entry) {
  if (!entries.includes(entry)) {
    entries.push(entry);
  }
  updateStack();
}

export function removeFromStack(entry) {
  const index = entries.indexOf(entry);
  if (index !== -1) {
    entries.splice(index, 1);
    entry.root.style.zIndex = '';
  }
  updateStack();
}
