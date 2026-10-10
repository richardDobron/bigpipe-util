# Changelog

All notable changes to `bigpipe-util` will be documented in this file.

Updates should follow the [Keep a CHANGELOG](http://keepachangelog.com/) principles.

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
