export const BIGPIPE_PHASE = Object.freeze({
  WAITING: 0,
  READY_FOR_JS: 1,
  LOADING_JS: 2,
  COMPLETE: 3
});

export const RESOURCE_PHASE = Object.freeze({
  PENDING: 0,
  LOADING: 1,
  LOADED: 2
});

export const PAGELET_PHASE = Object.freeze({
  ARRIVE_START: 0,
  LOADING_CSS: 1,
  DISPLAY_START: 2,
  DISPLAY_END: 3,
  ARRIVE_END: 4
});
