"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "BIGPIPE_EVENT", {
  enumerable: true,
  get: function () {
    return _BigPipePhases.BIGPIPE_EVENT;
  }
});
Object.defineProperty(exports, "BIGPIPE_PHASE", {
  enumerable: true,
  get: function () {
    return _BigPipePhases.BIGPIPE_PHASE;
  }
});
Object.defineProperty(exports, "PAGELET_EVENT", {
  enumerable: true,
  get: function () {
    return _BigPipePhases.PAGELET_EVENT;
  }
});
Object.defineProperty(exports, "PAGELET_PHASE", {
  enumerable: true,
  get: function () {
    return _BigPipePhases.PAGELET_PHASE;
  }
});
exports.default = void 0;
var _BigPipePhases = require("./BigPipePhases");
var _Bootloader = _interopRequireDefault(require("./Bootloader"));
var _Pagelet = _interopRequireDefault(require("./Pagelet"));
var _Arbiter = _interopRequireDefault(require("./core/Arbiter"));
var _Parent = require("./core/Parent");
var _onAfterLoad = _interopRequireDefault(require("./core/onAfterLoad"));
var _performanceNow = _interopRequireDefault(require("./core/performanceNow"));
var _reportError = _interopRequireDefault(require("./core/reportError"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
let instance = null;
class BigPipe {
  pagelets = new Map();
  phase = _BigPipePhases.BIGPIPE_PHASE.WAITING;
  ttiPhase = null;
  ttiReached = false;
  lastArrived = false;
  constructor() {
    if (instance) {
      return instance;
    }
    instance = this;
    this.inform(_BigPipePhases.BIGPIPE_EVENT.INIT);
  }

  /**
   * Informs a page event through Arbiter as a state, so a later subscriber gets it too.
   */
  inform(event, data = {}) {
    if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
      performance.mark(event);
    }
    new _Arbiter.default().informState(event, {
      ts: (0, _performanceNow.default)(),
      ...data
    });
  }

  /**
   * Starts a pagelet. A pagelet that fails to arrive is reported and does not stop the page.
   */
  onPageletArrive(pageletData) {
    try {
      this.arrive(pageletData);
    } catch (error) {
      (0, _reportError.default)(error);
    }
  }
  arrive(pageletData) {
    if (pageletData.resource_map) {
      _Bootloader.default.setResourceMap(pageletData.resource_map);
    }
    if (pageletData.bootloadable) {
      _Bootloader.default.enableBootload(pageletData.bootloadable);
    }
    if (pageletData.tti_phase !== undefined && pageletData.tti_phase !== null) {
      this.ttiPhase = Number(pageletData.tti_phase);
    }
    if (pageletData.is_last) {
      this.setPhase(_BigPipePhases.BIGPIPE_PHASE.READY_FOR_JS);
      this.lastArrived = true;
    }
    const previous = this.pagelets.get(pageletData.id);
    if (previous) {
      this.removePagelet(previous);
    }
    const pagelet = new _Pagelet.default(pageletData, this);
    this.registerPagelet(pagelet);
    pagelet.start();
    if (this.ttiReached && pagelet.displayPhase > this.ttiPhase) {
      pagelet.prefetchJs();
    }
    this.checkTti();
  }

  /**
   * Removes the pagelet and runs its destructors, also of the pagelets inside it.
   */
  removePagelet(pagelet) {
    if (this.pagelets.get(pagelet.id) === pagelet) {
      this.pagelets.delete(pagelet.id);
    }
    pagelet.destroy();
    this.displayWaitingPagelets();
    this.checkTti();
  }

  /**
   * Destroys the pagelets whose root is no longer on the page, e.g. replaced by a response.
   */
  destroyDetachedPagelets() {
    Array.from(this.pagelets.values()).forEach(pagelet => {
      const root = pagelet.getRoot();
      if (root && !root.isConnected) {
        this.removePagelet(pagelet);
      }
    });
  }
  destroyPageletsInside(parent) {
    const root = parent.getRoot();
    if (!root) {
      return;
    }
    Array.from(this.pagelets.values()).forEach(pagelet => {
      const pageletRoot = pagelet.getRoot();
      if (pagelet !== parent && pageletRoot && root.contains(pageletRoot)) {
        this.removePagelet(pagelet);
      }
    });
  }

  /**
   * The pagelet the node is in, e.g. to add a destructor for what a module did with the node.
   */
  getPageletForNode(node) {
    let found = null;
    (0, _Parent.find)(node, el => {
      const pagelet = el.id && el.id.startsWith('pagelet_') && this.pagelets.get(el.id.slice(8));
      if (pagelet && pagelet.getRoot() === el) {
        found = pagelet;
      }
      return found;
    });
    return found;
  }
  registerPagelet(pagelet) {
    this.pagelets.set(pagelet.id, pagelet);
  }
  areAllPageletsDisplayed() {
    if (this.pagelets.size === 0) {
      return false;
    }
    return Array.from(this.pagelets.values()).every(pagelet => pagelet.phase >= _BigPipePhases.PAGELET_PHASE.DISPLAY_END);
  }

  /**
   * Whether the pagelet may be displayed: after the pagelets of a lower `phase` that arrived, and
   * after its `display_dependency`, the pagelets it has to be displayed after.
   */
  canDisplay(pagelet) {
    const isDisplayed = other => other.phase >= _BigPipePhases.PAGELET_PHASE.DISPLAY_END;
    return Array.from(this.pagelets.values()).every(other => other.displayPhase >= pagelet.displayPhase || isDisplayed(other)) && pagelet.displayDependency.every(id => {
      const dependency = this.pagelets.get(id);
      return dependency && isDisplayed(dependency);
    });
  }
  displayWaitingPagelets() {
    this.pagelets.forEach(pagelet => pagelet.display());
  }
  pageletDisplayed() {
    this.displayWaitingPagelets();
    this.checkTti();
    if (this.phase === _BigPipePhases.BIGPIPE_PHASE.READY_FOR_JS && this.areAllPageletsDisplayed()) {
      this.loadJSResources();
    }
  }

  /**
   * Informs `tti_bigpipe` once every pagelet of the phases up to `tti_phase` is displayed and no
   * more of them can arrive, then loads the JS files of the later phases in the background.
   */
  checkTti() {
    if (this.ttiReached || this.ttiPhase === null) {
      return;
    }
    const pagelets = Array.from(this.pagelets.values());
    const complete = this.lastArrived || pagelets.some(pagelet => pagelet.displayPhase > this.ttiPhase);
    const isEarly = pagelet => pagelet.displayPhase <= this.ttiPhase;
    if (!complete || !pagelets.filter(isEarly).every(pagelet => pagelet.phase >= _BigPipePhases.PAGELET_PHASE.DISPLAY_END)) {
      return;
    }
    this.ttiReached = true;
    this.inform(_BigPipePhases.BIGPIPE_EVENT.TTI, {
      phase: this.ttiPhase
    });
    pagelets.filter(pagelet => !isEarly(pagelet)).forEach(pagelet => pagelet.prefetchJs());
  }

  /**
   * Forgets the time to interactive of the page, for the next page of a page transition.
   */
  resetTti() {
    this.ttiPhase = null;
    this.ttiReached = false;
    this.lastArrived = false;
    new _Arbiter.default().clearState(_BigPipePhases.BIGPIPE_EVENT.TTI);
  }
  pageletFinished() {
    if (this.phase !== _BigPipePhases.BIGPIPE_PHASE.LOADING_JS) {
      return;
    }
    if (!Array.from(this.pagelets.values()).every(pagelet => pagelet.isComplete())) {
      return;
    }
    this.setPhase(_BigPipePhases.BIGPIPE_PHASE.COMPLETE);
    this.inform(_BigPipePhases.BIGPIPE_EVENT.LOADED);
    (0, _onAfterLoad.default)(() => {
      this.pagelets.forEach(pagelet => {
        pagelet.processAfterLoadJsMods();
      });
    });
  }
  setPhase(newPhase) {
    this.phase = newPhase;
  }
  loadJSResources() {
    this.inform(_BigPipePhases.BIGPIPE_EVENT.DISPLAYED);
    this.setPhase(_BigPipePhases.BIGPIPE_PHASE.LOADING_JS);
    this.pagelets.forEach(pagelet => {
      pagelet.startJs();
    });
    this.pageletFinished();
  }
  fileLoaded(file) {
    _Bootloader.default.done(file);
  }
  resolveResourceName(file) {
    return _Bootloader.default.resolveURL(file);
  }
}
exports.default = BigPipe;