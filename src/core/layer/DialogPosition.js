const MIN_TOP_MARGIN = 40;

export function calculateTopMargin(
  height,
  { top = null, centered = false, ignoreTopInShortViewport = false } = {}
) {
  const viewportHeight = window.innerHeight;

  if (top !== null && !(ignoreTopInShortViewport && top + height > viewportHeight)) {
    return top;
  }

  const free = viewportHeight - height;
  return Math.max(Math.floor(centered ? free / 2 : free / 3), MIN_TOP_MARGIN);
}

export default { calculateTopMargin };
