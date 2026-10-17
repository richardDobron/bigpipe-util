// The modal layers and the dialogs share one lock of the scrolling of the page: it is released when
// the last of them is hidden. Inline styles only, so it works without any CSS framework.
let count = 0;
let saved = null;

export function lockScroll() {
  count += 1;
  if (saved) {
    return;
  }

  const { body, documentElement } = document;
  saved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };

  // The scrollbar goes away: the padding keeps the content where it was.
  const scrollbar = window.innerWidth - documentElement.clientWidth;
  if (scrollbar > 0) {
    body.style.paddingRight = `${(parseFloat(window.getComputedStyle(body).paddingRight) || 0) + scrollbar}px`;
  }
  body.style.overflow = 'hidden';
}

export function unlockScroll() {
  count = Math.max(count - 1, 0);
  if (count || !saved) {
    return;
  }

  document.body.style.overflow = saved.overflow;
  document.body.style.paddingRight = saved.paddingRight;
  saved = null;
}
