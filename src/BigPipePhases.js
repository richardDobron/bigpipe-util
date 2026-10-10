export const BIGPIPE_PHASE = Object.freeze({
  WAITING: 0,
  READY_FOR_JS: 1,
  LOADING_JS: 2,
  COMPLETE: 3
});

export const PAGELET_PHASE = Object.freeze({
  ARRIVE_START: 0,
  LOADING_CSS: 1,
  DISPLAY_START: 2,
  DISPLAY_END: 3,
  ARRIVE_END: 4
});

export const PAGELET_EVENT = Object.freeze({
  ARRIVE: 'arrive',
  CSS: 'css',
  CSS_LOAD: 'css_load',
  DISPLAY_START: 'display_start',
  DISPLAY: 'display',
  JS_START: 'jsstart',
  JS_DONE: 'jsdone',
  ONLOAD: 'onload'
});

export const BIGPIPE_EVENT = Object.freeze({
  INIT: 'BigPipe/init',
  DISPLAYED: 'all_pagelets_displayed',
  LOADED: 'all_pagelets_loaded'
});
