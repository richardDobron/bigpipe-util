import { RESOURCE_PHASE, PAGELET_PHASE } from './BigPipePhases';
import ServerJS from './ServerJS';
import AsyncDOM from './async/AsyncDOM';
import invariant from './core/invariant';

const serverJS = new ServerJS();
const asyncDOM = new AsyncDOM();

export { PAGELET_PHASE };

function areAllResourcesLoaded(resources) {
  if (resources.size === 0) {
    return true;
  }
  return Array.from(resources.values()).every(resource => resource.phase === RESOURCE_PHASE.LOADED);
}

export default class Pagelet {
  constructor(pageletData, bigPipe) {
    invariant(
      bigPipe,
      'Pagelet "%s" has to be created by BigPipe.onPageletArrive().',
      pageletData.id
    );

    this.bigPipe = bigPipe;
    this.id = pageletData.id;
    this.phase = PAGELET_PHASE.ARRIVE_START;
    this.domops = pageletData.domops;
    this.jsmods = pageletData.jsmods;
    this.onafterload = pageletData.onafterload;
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

    this.css.forEach(cssFile => {
      this.attachCssResource(this.bigPipe.pageletResourceFactory(cssFile, 'css'));
    });

    this.js.forEach(jsFile => {
      this.attachJsResource(this.bigPipe.pageletResourceFactory(jsFile, 'js'));
    });

    this.setPhase(PAGELET_PHASE.LOADING_CSS);
    this.cssResources.forEach(resource => {
      resource.startLoading();
    });

    // A stylesheet that another pagelet already loaded will not call back again.
    this.onCssFinished();
  }

  attachCssResource(resource) {
    resource.attachToPagelet(() => this.onCssFinished(resource));
    this.cssResources.set(resource.file, resource);
  }

  attachJsResource(resource) {
    resource.attachToPagelet(() => this.onJsFinished());
    this.jsResources.set(resource.file, resource);
  }

  /**
   * Runs the jsmods once the JS files of the pagelet are loaded. BigPipe calls it when it starts
   * loading the JS of all pagelets, and every JS file calls it when it is loaded.
   */
  onJsFinished() {
    if (this.phase !== PAGELET_PHASE.DISPLAY_END) {
      return;
    }

    if (!areAllResourcesLoaded(this.jsResources)) {
      return;
    }

    this.processJsMods();

    this.setPhase(PAGELET_PHASE.ARRIVE_END);
    this.bigPipe.pageletFinished(this);
  }

  processJsMods() {
    serverJS.handle(this.jsmods);
  }

  /**
   * Handles the `onafterload` jsmods, which BigPipe runs once every pagelet has run its jsmods and
   * the window has loaded.
   */
  processAfterLoadJsMods() {
    const { onafterload } = this;
    this.onafterload = null;

    if (onafterload) {
      serverJS.handle(onafterload);
    }
  }

  onCssFinished() {
    if (this.phase !== PAGELET_PHASE.LOADING_CSS || !areAllResourcesLoaded(this.cssResources)) {
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
