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
  CSS_LOAD: 'cssLoad',
  DISPLAY_START: 'displayStart',
  DISPLAY: 'display',
  JS_START: 'jsStart',
  JS_DONE: 'jsDone',
  ONLOAD: 'onload'
});

export const BIGPIPE_EVENT = Object.freeze({
  INIT: 'BigPipe/init',
  TTI: 'BigPipe/tti',
  // Every pagelet of a phase of the page is displayed, with the phase; see last_in_phase.
  PHASE_DISPLAYED: 'BigPipe/phaseDisplayed',
  DISPLAYED: 'BigPipe/allPageletsDisplayed',
  LOADED: 'BigPipe/allPageletsLoaded'
});
