"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "PAGELET_PHASE", {
  enumerable: true,
  get: function () {
    return _BigPipe.PAGELET_PHASE;
  }
});
exports.default = void 0;
var _BigPipe = _interopRequireWildcard(require("./BigPipe"));
var _ServerJS = _interopRequireDefault(require("./ServerJS"));
var _AsyncDOM = _interopRequireDefault(require("./async/AsyncDOM"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
const serverJS = new _ServerJS.default();
const asyncDOM = new _AsyncDOM.default();
const bigPipe = new _BigPipe.default();
function areAllResourcesLoaded(resources) {
  if (resources.size === 0) {
    return true;
  }
  return Array.from(resources.values()).every(resource => resource.phase === _BigPipe.RESOURCE_PHASE.LOADED);
}
class Pagelet {
  cssResources = new Map();
  jsResources = new Map();
  id = '';
  phase = _BigPipe.PAGELET_PHASE.ARRIVE_START;
  constructor(pageletData) {
    this.bigPipe = bigPipe;
    this.id = pageletData.id;
    this.phase = _BigPipe.PAGELET_PHASE.ARRIVE_START;
    this.domops = pageletData.domops;
    this.jsmods = pageletData.jsmods;
    this.css = pageletData.css;
    this.js = pageletData.js;
    this.cssResources = new Map();
    this.jsResources = new Map();
  }
  isComplete() {
    return this.phase === _BigPipe.PAGELET_PHASE.ARRIVE_END;
  }
  setPhase(phase) {
    this.phase = phase;
  }
  start() {
    if (this.phase !== _BigPipe.PAGELET_PHASE.ARRIVE_START) {
      return;
    }
    if (this.css.length > 0) {
      this.css.forEach(cssFile => {
        const cssResource = this.bigPipe.pageletResourceFactory(cssFile, 'css');
        this.attachCssResource(cssResource);
      });
    }
    if (this.js.length > 0) {
      this.js.forEach(jsFile => {
        const jsResource = this.bigPipe.pageletResourceFactory(jsFile, 'js');
        this.attachJsResource(jsResource);
      });
    }
    if (this.cssResources.size > 0) {
      this.setPhase(_BigPipe.PAGELET_PHASE.LOADING_CSS);
      this.cssResources.forEach(resource => {
        resource.startLoading();
      });
    } else {
      this.setContent();
      this.onJsFinished();
    }
  }
  attachCssResource(resource) {
    resource.attachToPagelet(() => this.onCssFinished(resource));
    this.cssResources.set(resource.file, resource);
  }
  attachJsResource(resource) {
    resource.attachToPagelet(() => this.onJsFinished());
    this.jsResources.set(resource.file, resource);
  }
  onJsFinished() {
    if (this.isComplete()) {
      return;
    }
    if (!areAllResourcesLoaded(this.jsResources)) {
      return;
    }
    this.processJsMods();
    this.setPhase(_BigPipe.PAGELET_PHASE.ARRIVE_END);
  }
  processJsMods() {
    serverJS.handle(this.jsmods);
  }
  onCssFinished() {
    if (!areAllResourcesLoaded(this.cssResources)) {
      return;
    }
    this.setContent();
  }
  setContent() {
    this.setPhase(_BigPipe.PAGELET_PHASE.DISPLAY_START);
    if (this.domops) {
      asyncDOM.invoke(this.domops);
    }
    this.setPhase(_BigPipe.PAGELET_PHASE.DISPLAY_END);
    this.bigPipe.pageletDisplayed(this);
  }
}
exports.default = Pagelet;