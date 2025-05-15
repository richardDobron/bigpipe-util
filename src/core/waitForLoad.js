import onAfterLoad from "./onAfterLoad";

let loadingCounter = 0;
let originalCursor = '';

export default function waitForLoad(elementOnClicked, event, callback = () => {
}) {
  const boundCallback = callback.bind(elementOnClicked, event);
  const body = document.body;

  if (document.readyState === 'complete') {
    return boundCallback();
  }

  const type = (event || window.event).type;
  loadingCounter++;

  if (loadingCounter === 1) {
    originalCursor = body.style.cursor;
    body.style.cursor = 'progress';
  }

  switch (type) {
    case 'load':
    case 'focus':
      onAfterLoad(boundCallback);
      return;

    case 'click':
      elementOnClicked.style.cursor = 'progress';

      onAfterLoad(() => {
        loadingCounter--;

        if (loadingCounter === 0) {
          body.style.cursor = originalCursor;
        }

        elementOnClicked.style.cursor = '';

        const result = boundCallback();
        const href = elementOnClicked.getAttribute('href');

        if (
          elementOnClicked.tagName.toLowerCase() === 'a' &&
          result !== false &&
          href
        ) {
          window.location.href = href;
        } else {
          elementOnClicked.click();
        }
      });
  }

  return false;
}
