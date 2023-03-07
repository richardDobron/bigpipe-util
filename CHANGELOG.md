# Changelog

All notable changes to `bigpipe-util` will be documented in this file.

Updates should follow the [Keep a CHANGELOG](http://keepachangelog.com/) principles.

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
