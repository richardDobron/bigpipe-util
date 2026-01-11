import BigPipe, { RESOURCE_PHASE } from "./BigPipe";
import ServerJS from "./ServerJS";
import AsyncDOM from "./async/AsyncDOM";

const serverJS = new ServerJS();
const asyncDOM = new AsyncDOM();
const bigPipe = new BigPipe();

export const PAGELET_PHASE = Object.freeze({
  ARRIVE_START: 0,
  LOADING_CSS: 1,
  DISPLAY_START: 2,
  DISPLAY_END: 3,
  ARRIVE_END: 4
});

function areAllResourcesLoaded(resources) {
  if (resources.size === 0) {
    return true;
  }
  return Array.from(resources.values()).every(
    resource => resource.phase === RESOURCE_PHASE.LOADED
  );
}

export default class Pagelet {
  cssResources = new Map();

  jsResources = new Map();

  id = "";

  phase = PAGELET_PHASE.ARRIVE_START;

  constructor(pageletData) {
    this.bigPipe = bigPipe;
    this.id = pageletData.id;
    this.phase = PAGELET_PHASE.ARRIVE_START;
    this.domops = pageletData.domops;
    this.jsmods = pageletData.jsmods;
    this.css = pageletData.css;
    this.js = pageletData.js;
    this.cssResources = new Map();
    this.jsResources = new Map();
  }

  isComplete() {
    return this.phase === PAGELET_PHASE.ARRIVE_END;
  }

  setPhase(phase) {
    this.phase = phase;
  }

  start() {
    if (this.phase !== PAGELET_PHASE.ARRIVE_START) {
      return;
    }

    if (this.css.length > 0) {
      this.css.forEach((cssFile) => {
        const cssResource = this.bigPipe.pageletResourceFactory(cssFile, 'css');
        this.attachCssResource(cssResource);
      });
    }

    if (this.js.length > 0) {
      this.js.forEach((jsFile) => {
        const jsResource = this.bigPipe.pageletResourceFactory(jsFile, 'js');
        this.attachJsResource(jsResource);
      });
    }

    if (this.cssResources.size > 0) {
      this.setPhase(PAGELET_PHASE.LOADING_CSS);
      this.cssResources.forEach((resource) => {
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

    this.setPhase(PAGELET_PHASE.ARRIVE_END);
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
    this.setPhase(PAGELET_PHASE.DISPLAY_START);

    if (this.domops) {
      asyncDOM.invoke(this.domops);
    }

    this.setPhase(PAGELET_PHASE.DISPLAY_END);
    this.bigPipe.pageletDisplayed(this);
  }
}
