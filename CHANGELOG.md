# Changelog

All notable changes to `bigpipe-util` will be documented in this file.

Updates should follow the [Keep a CHANGELOG](http://keepachangelog.com/) principles.

## v2.1.0 - 2026-10-11

### Added
- A new deploy: a response with a `revision` other than the `BigPipeRevision` of the page informs `BigPipe/newRevision`,
  and the next Quickling page transition loads the page in full.
- HTML containers: the content of a DOM operation can be `{"__container": id}`, a hidden `<code>` element of the page
  with the HTML in a comment, which the PHP library prints for the pagelets of a page.
- Trusted Types: the HTML of the server, the scripts the Bootloader loads and the code of the `eval` DOM operation
  go through the `bigpipe` policy, so a Content Security Policy with `require-trusted-types-for 'script'` works with
  `trusted-types bigpipe`.
- Modules the server chooses: a define `{"__rc": module}` makes a module stand for the one the server chose, e.g. by a
  feature flag, or `null` to turn it off. Only the resources of the chosen module are loaded.
- `last_in_phase` of a pagelet completes its phase: the time to interactive no longer waits for the next phase,
  and `BigPipe/phaseDisplayed` is informed with every phase that is displayed; see `BigPipe.isPhaseDisplayed()`.
- `BigPipeQueue`: the inline scripts of the PHP library push their calls to `window.__bigpipe`, and `ModuleRegistry`
  runs them once the module loader is set, so the entrypoint can be loaded `async`, `defer` or as a module script.
- `Bootloader.getErrorURLs()` lists the stylesheets and scripts that failed to load.
- `ServerRedirect.redirectPageTo()` takes `replace` and `transition`: replace the history entry, or load the page with
  a page transition.
- The `__rel` marker stands for the element that sent the request; `ServerJS.handle()` takes it.
- The layers and their behaviors are built-in modules of `ModuleRegistry`, so the server can create them.
- `BigPipe.startPage()` makes the pagelets of a response the next page, see Quickling.

### Changed
- The page events are named like `BigPipe/init`: `tti_bigpipe` is `BigPipe/tti`, `all_pagelets_displayed` is
  `BigPipe/allPageletsDisplayed` and `all_pagelets_loaded` is `BigPipe/allPageletsLoaded`, see `BIGPIPE_EVENT`.
- The other events are named the same way: `Pagelet/event`, `Pagelet/destroy` and `Pagelet/error`; the steps of a
  pagelet `cssLoad`, `displayStart`, `jsStart` and `jsDone`; `Quickling/send`, `Quickling/firstResponse`,
  `Quickling/beforeClearCanvas`, `Quickling/unload` and `Quickling/response`; `PageTransitions/beforeTransition`,
  `PageTransitions/transition`, `PageTransitions/beforeFragmentTransition` and `PageTransitions/fragmentTransition`,
  exported as `PAGE_TRANSITION_EVENT`; `DocumentTitle/update`, `Visibility/hidden`, `Visibility/visible` and
  `UserActivity/activity`, whose `last_inform` is `lastInform`.
- The pagelets of a response, e.g. a lazy pagelet, are kept apart from the page: they load their JS once all of them
  are displayed, and no longer start the JS of the page or inform `BigPipe/allPageletsDisplayed` and `BigPipe/allPageletsLoaded`.
- A response whose error is a warning goes to the handler, not to the error handler.
- Only a 2xx status is a success. A BigPipe response with an error status, e.g. `send(422)`, is applied and its error
  goes to the error handler.
- A script that fails to load is requested again twice, and a failed resource is reported.
- A delayed server redirect does not happen once the page is left with a page transition.
- A page transition without a `body_class` keeps the class of `<body>`.
- Escape and other keys typed in a text field that is not empty no longer reach the layer it is in.
- Dialogs, modal layers and contextual layers share one stacking order.

### Fixed

#### Requests
- A `rel="async"` link without `ajaxify` is sent to its `href`, not to `null`.
- Whitespace or a byte order mark before the `for (;;);` shield no longer makes the response invalid, and
  `for(;;);` is accepted.
- A response that is `null` or not an object is an `invalid_response` error instead of an exception.
- The rest of a streamed response that failed is applied but no longer handled as a success.
- The timeout of a streamed response stops at its first part.
- A timeout or `abort()` ends the wait for a new CSRF token.

#### Pagelets and modules
- A stylesheet that does not load in 5 seconds no longer holds up the page.
- An async, deferred or module script, or a stylesheet in the body, that is on the page is waited for until it loaded.
- A call waits for the bootloadable modules of its arguments and the classes of the instances it uses.
- A Quickling page transition clears the `BigPipe/allPageletsLoaded` state of the previous page.

#### Page transitions
- `PageTransitions.go(uri, true)` replaces the current history entry, so the back button no longer returns to a URL
  the server redirected from.
- A link to an empty fragment of the current page, like `href="#"`, no longer reloads the page.
- The back and forward buttons load the page of history entries that other scripts added, and only scroll for an
  entry of another fragment of the page.
- Staying on a page after the back or forward button asked to confirm leaving it keeps the forward history.
- Every history entry keeps its own scroll position, also in its `history.state`, so it is restored after a reload.
- A page kept in the back/forward cache no longer runs its `Run.onLeave()` and `Run.onUnload()` hooks.
- A finally handler set by a Poller's `setupRequest` no longer stops the polling.

#### Layers and dialogs
- `Dialog.close(0)` closes no dialog instead of every one.
- Dialogs with the same markup are told apart.
- Escape goes to the topmost layer first, so a menu open over a dialog closes before the dialog.
- A contextual layer inserted in a positioned or transformed element is placed relative to it, it is placed above
  the dialog its context is in, and it is not shown while its context is not displayed.
- `getTabbable` and tab isolation skip hidden elements, and Tab stays in a dialog while a menu that does not trap is
  open over it.
- When the element that opened a layer is hidden, the focus goes back to the closest visible element.
- A dialog gives the focus back to the element that sent its request, or the focused element inside of it.
- A destroyed layer can no longer be shown again.
- Nested contextual layers, like submenus, count as part of the layers they are opened from at any depth and hide
  with them.

## v2.0.0 - 2026-10-10

Works with `richarddobron/bigpipe` 2.x.

### Added

#### Pagelets
- Pagelets are displayed by phase and `display_dependency`; the lifecycle and the page events are informed with timing,
  `tti_bigpipe` is informed and the JS of the later phases is prefetched once the TTI phases are displayed.
- Pagelet destructors: a pagelet is destroyed when a response removes its root, and its lifecycle stops.
- Responses can carry pagelets; `UIPagelet` loads pagelets from an endpoint and `MorePagerFetchOnScroll` loads the
  next page of a feed on scroll. Both stop with their pagelet.
- Pagelet resources are told apart by their URL and split into display resources and the rest; the `onload` and
  `jsNonBlock` options, and `onafterload` jsmods run once the page has finished.
- A failing pagelet or jsmod is isolated and reported with `reportError()`, the page goes on.

#### Page transitions, Bootloader, Poller
- Page transitions (`Quickling`, `PageTransitions`); the requests of a page are abandoned on a transition.
- `Bootloader` with a resource map: bootloadable modules are loaded on demand, or preloaded while the network is idle.
- `Poller`, `Visibility` and `UserActivity`.

#### Requests and responses
- Request retries and `abandon()`; `AsyncRequest` is loaded on demand by the Primer.
- Streamed responses are processed in parts.
- Morph DOM operations (`morph`, `morphContent`) keep the focus, the caret and the values of a form.
- The CSRF token the server defines is sent with requests; a request is sent again once the server refreshed an
  expired token.
- The success event is dispatched from the relative element of a request.
- `ServerJS` defines modules and instances, and runs a custom module resolver.
- The CSP nonce the server defines is added to the files BigPipe loads.

#### Module helpers and utilities
- `ifRequired`, `requireDeferred` and `requireCond`; `invariant` and `warning` replace the `fbjs` dependency.
- `Run` hooks for loading and leaving a page.
- `Utilities`: `onAfterLoad`, `onVisible`, `ReloadPage`, `ServerRedirect`, `DataStore`, `DocumentTitle`,
  `KeyEventController`, `WebStorage` and `Cookie`.
- `Arbiter.subscribe()` returns a subscription, and there are state events.

#### Layers, forms
- `Layer` with behaviors (hide on Escape, blur, success and page transition; autofocus; tab isolation; refocus; fade
  in and out; remove and destroy on hide), `ModalLayer` and `ContextualLayer`. Dialogs are built on `Layer` and keep
  their events.
- `FormMonitor` warns about unsaved changes before a page is left.
- `Form` helpers (`serialize`, `setDisabled`); the progress of file uploads of async forms is reported.

#### Build
- An ESM build and a release workflow.

### Changed
- Request data encodes `null`, `undefined` and empty arrays, and sends booleans as `1` and `0`; the `Content-Type` of
  `PUT`, `PATCH` and `DELETE` data is set.
- `AsyncRequest` and `Arbiter` report errors with `reportError()`.
- Fixed `Arbiter` events named after the properties of `Object`.
- A pagelet with CSS or JS files finishes loading, and a `form` loader is handled.

### Deprecated
- The `eval` DOM operation: a Content Security Policy without `'unsafe-eval'` blocks it.

### Removed
- `waitForLoad`: use `onAfterLoad`, `requireDeferred` or `Run` hooks.
- The `fbjs` dependency.

## v0.2.13 - 2026-04-05
### Fixed
- submitter and \_\_DEV\_\_ checks

## v0.2.12 - 2026-01-12
### Added
- Added `Pagelet.js`, `BigPipe.js`

## v0.2.11 - 2025-12-27
### Added
- Added `incrementRequests` method to AsyncRequest.js
- Added submitter to form data in onSubmit handler

## v0.2.10 - 2025-05-15

### Added
- Added `onAfterLoad.js`, `waitForLoad.js`
- Added `timeout` to open dialog with a delay in method `showFromModel`

## v0.2.8 - 2025-05-02

### Added
- Added `timeout` to open dialog with a delay in method `showFromModel`

## v0.2.7 - 2025-03-22

### Added
- Added `timeout` to open dialog with a delay in method `render`

## v0.2.6 - 2025-01-16

### Added
- Added `limit` parameter to `Dialog.js` for limiting the number of closed dialogs

## v0.2.5 - 2023-03-07

### Added
- Added `Arbiter.js` event system
- Added methods `byClass`, `byAttribute`, `find` to `Parent.js`

### Fixed
- Fixed controller calling

## v0.2.4 - 2023-02-03

### Fixed
- Fixed controller calling

## v0.2.3 - 2023-02-04

### Added
- Added setFinallyHandler for AsyncRequest

## v0.2.2 - 2022-08-03

### Fixed
- Calls for modules without constructor
- Dialog opening when using instant closing

## v0.2.1 - 2022-06-02

### Added
- Prevent links from being double-clicked
- Support for keyboard (close by escape)

### Fixed
- Closing dialogs with [esc] in the correct order

## v0.2.0 - 2022-05-17

### Added
- Shield to prevent "JSON Hijacking"
- Invalid node checking for AsyncDOM

### Fixed
- Backdrop for 2+ opened dialogs

## v0.1.4 - 2022-05-06

### Added
- Async requests counter
- Support for extra arguments in dialog controller

### Fixed
- Arguments for non-method require calls

## v0.1.3 - 2022-04-27

### Added
- Method to close only current dialog

### Fixed
- Dialog z-index

## v0.1.2 - 2022-04-14

### Added
- Dialogs support.

## v0.1.1 - 2022-03-27

### Added
- Part of BigPipe implementation for Webpack.
