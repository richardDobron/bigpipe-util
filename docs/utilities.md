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

See [Run](run.md) for removable subscriptions and the hooks for leaving a page.

## onVisible

Calls the callback once, when the element comes within `buffer` pixels of the viewport, e.g. to load content right
before the user scrolls to it. `remove()` of the returned subscription stops waiting.

```javascript
import onVisible from 'bigpipe-util/dist/core/onVisible';

const subscription = onVisible(element, () => console.log('Almost visible.'), { buffer: 300 });
```

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
new ServerRedirect().redirectPageTo('/feed', 0, true, true); // replace the history entry, page transition
```

It loads the URL in full, or with `transition` with a [page transition](page_transitions.md) when the page has them
on. `replace` replaces the current history entry, e.g. of a form that should not be sent again with the back button.
A redirect with a delay does not happen once the page is left with a page transition.

The server calls it with `$response->redirect($url, $delay, $replace, $transition)`.

## DataStore

Keeps data for an element, any other object or a string namespace, without putting it on the element. The data of an
element goes away with the element.

```javascript
import DataStore from 'bigpipe-util/dist/core/DataStore';

DataStore.set(button, 'tooltip', tooltip);
DataStore.get(button, 'tooltip');
DataStore.get(button, 'count', 0);   // the data-count attribute of the element, or else 0
DataStore.remove(button, 'tooltip');
DataStore.purge(button);             // removes all data of the element
```

## DocumentTitle

Sets the title of the page and lets it blink, e.g. to show a new message in a background tab. Page transitions set the
title with it too.

```javascript
import DocumentTitle from 'bigpipe-util/dist/core/DocumentTitle';

DocumentTitle.set('Messages');        // informs update_title
DocumentTitle.set('(2) Messages', true); // a temporary title, get() still returns 'Messages'

const blinking = DocumentTitle.blink('New message'); // alternates every 1.5 seconds
blinking.stop();
```

## KeyEventController

Keyboard shortcuts. A key is a name of `KeyEventController.KEYS` (`ESCAPE`, `RETURN`, `SLASH`, `UP`, ...) or a
character. By default, a shortcut runs on keydown without Ctrl, Alt or Meta, and not while the user types in a text
field, except navigation keys like `ESCAPE` in an empty one. A callback that returns `false` prevents the default action
and stops the other shortcuts of the key.

```javascript
import KeyEventController from 'bigpipe-util/dist/core/KeyEventController';

KeyEventController.registerKey('j', () => feed.next());
KeyEventController.registerKey('SLASH', () => {
  search.focus();
  return false;
});

const subscription = KeyEventController.registerKeyAcrossTransitions('ESCAPE', () => dialog.hide());
subscription.remove();
```

A [page transition](page_transitions.md) removes the shortcuts of the page; the ones registered across transitions
stay. `registerKey(key, callback, filter, replace)` takes another filter `(event, type) => boolean`, and with
`replace` it replaces the other shortcuts of the key.

## WebStorage

The local and session storage, or `null` when the browser does not allow them, e.g. in a private window, and reads and
writes that never throw.

```javascript
import WebStorage from 'bigpipe-util/dist/core/WebStorage';

const storage = WebStorage.getLocalStorage(); // or getSessionStorage()
const error = WebStorage.setItemGuarded(storage, 'draft', text); // null, or the error, e.g. a full storage
const draft = WebStorage.getItemGuarded(storage, 'draft');      // null without the storage
WebStorage.removeItemGuarded(storage, 'draft');
```

## Cookie

Reads and writes cookies. A cookie is set for the path `/` with `SameSite=Lax`, and `Secure` on HTTPS.

```javascript
import Cookie from 'bigpipe-util/dist/core/Cookie';

Cookie.set('theme', 'dark', { lifetime: 365 * 24 * 60 * 60 * 1000 }); // milliseconds, a session cookie without it
Cookie.get('theme'); // 'dark', or null
Cookie.clear('theme');
```

`set()` also takes `path`, `domain`, `secure` and `sameSite`, and `clear()` takes `path` and `domain`.
