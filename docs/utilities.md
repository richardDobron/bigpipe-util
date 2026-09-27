---
id: utilities
title: Utilities
sidebar_label: Utilities
---

## onAfterLoad

Calls the callback after the `load` event of the window, or on the next tick if the page is already loaded.

```javascript
import onAfterLoad from 'bigpipe-util/dist/core/onAfterLoad';

onAfterLoad(() => console.log('The page is loaded.'));
```

## waitForLoad

Clicks made before the page is loaded would be lost, because the handlers aren't attached yet. `waitForLoad` defers
them: it shows the `progress` cursor, waits for the page to load and then calls the callback. Then it follows the
`href` of a link, or repeats the click when the callback returns `false` or the element isn't a link, so the
click is handled by the listeners attached in the meantime.

```javascript
import { byTag } from 'bigpipe-util/dist/core/Parent';
import onAfterLoad from 'bigpipe-util/dist/core/onAfterLoad';
import waitForLoad from 'bigpipe-util/dist/core/waitForLoad';

const clickHandler = (event) => {
  const link = byTag(event.target, 'A');

  if (!link || !/async(?:-post)?|dialog/.test(link.rel)) {
    return;
  }

  event.preventDefault();
  waitForLoad(link, event, () => false);
};

document.documentElement.addEventListener('click', clickHandler);

onAfterLoad(() => {
  document.documentElement.removeEventListener('click', clickHandler);
});
```

Put this code inline in the `<head>`, so it runs before the rest of your JavaScript is loaded.

## ReloadPage

```javascript
import ReloadPage from 'bigpipe-util/dist/core/ReloadPage';

new ReloadPage().now();
new ReloadPage().delay(250); // in ms
```

The server calls it with `$response->reload($delay)`.

## ServerRedirect

```javascript
import ServerRedirect from 'bigpipe-util/dist/core/ServerRedirect';

new ServerRedirect().redirectPageTo('/onboarding', 500); // delay in ms
```

The server calls it with `$response->redirect($url, $delay)`.
