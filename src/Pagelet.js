import { RESOURCE_PHASE, PAGELET_PHASE, PAGELET_EVENT } from './BigPipePhases';
import ServerJS from './ServerJS';
import AsyncDOM from './async/AsyncDOM';
import Arbiter from './core/Arbiter';
import DOM from './core/DOM';
import invariant from './core/invariant';
import performanceNow from './core/performanceNow';
import reportError from './core/reportError';

const serverJS = new ServerJS();
const asyncDOM = new AsyncDOM();

export { PAGELET_PHASE, PAGELET_EVENT };

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
    this.displayPhase = pageletData.phase || 0;
    this.displayDependency = pageletData.display_dependency || [];
    this.css = pageletData.css;
    this.js = pageletData.js;
    this.cssResources = new Map();
    this.jsResources = new Map();
    this.root = null;
    this.destroyed = false;
    this.cssLoaded = false;
    this.jsStarted = false;
    this.timings = {};
    this.destructors = [
      () => new Arbiter().inform('pagelet/destroy', { id: this.id, root: this.root })
    ];
  }

  /**
   * The root element of the pagelet, `#pagelet_<id>`, once the pagelet is displayed.
   */
  getRoot() {
    return this.root;
  }

  /**
   * Runs `destructor` when the pagelet is destroyed: when a pagelet with the same id replaces it,
   * or a response removes its root. Use it to stop what a module started for the pagelet.
   */
  addDestructor(destructor) {
    if (this.destroyed) {
      destructor();
      return;
    }

    this.destructors.push(destructor);
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;

    this.bigPipe.destroyPageletsInside(this);

    this.destructors.splice(0).forEach(destructor => {
      try {
        destructor();
      } catch (error) {
        reportError(error);
      }
    });

    if (this.root) {
      DOM.empty(this.root);
    }
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

    this.inform(PAGELET_EVENT.ARRIVE);

    this.setPhase(PAGELET_PHASE.LOADING_CSS);
    this.inform(PAGELET_EVENT.CSS);
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
   * Records the time of a lifecycle event in `timings` and informs `pagelet_event` with it.
   */
  inform(event) {
    const ts = performanceNow();
    this.timings[event] = ts;

    if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
      performance.mark(`pagelet_${this.id}_${event}`);
    }

    new Arbiter().inform('pagelet_event', { event, id: this.id, ts });
  }

  /**
   * BigPipe calls it when it starts loading the JS of all pagelets.
   */
  startJs() {
    if (this.destroyed || this.phase !== PAGELET_PHASE.DISPLAY_END || this.jsStarted) {
      return;
    }

    this.jsStarted = true;
    this.inform(PAGELET_EVENT.JS_START);
    this.onJsFinished();
  }

  /**
   * Runs the jsmods once the JS files of the pagelet are loaded. Every JS file calls it when it
   * is loaded.
   */
  onJsFinished() {
    if (this.destroyed || this.phase !== PAGELET_PHASE.DISPLAY_END || !this.jsStarted) {
      return;
    }

    if (!areAllResourcesLoaded(this.jsResources)) {
      return;
    }

    this.inform(PAGELET_EVENT.JS_DONE);
    this.processJsMods();

    this.setPhase(PAGELET_PHASE.ARRIVE_END);
    this.inform(PAGELET_EVENT.ONLOAD);
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
    if (
      this.destroyed ||
      this.cssLoaded ||
      this.phase !== PAGELET_PHASE.LOADING_CSS ||
      !areAllResourcesLoaded(this.cssResources)
    ) {
      return;
    }

    this.cssLoaded = true;
    this.inform(PAGELET_EVENT.CSS_LOAD);
    this.display();
  }

  /**
   * Displays the pagelet once its CSS is loaded and BigPipe allows it: after the pagelets of a
   * lower `phase` and its `display_dependency`.
   */
  display() {
    if (
      this.destroyed ||
      !this.cssLoaded ||
      this.phase !== PAGELET_PHASE.LOADING_CSS ||
      !this.bigPipe.canDisplay(this)
    ) {
      return;
    }

    this.setContent();
  }

  setContent() {
    this.setPhase(PAGELET_PHASE.DISPLAY_START);
    this.inform(PAGELET_EVENT.DISPLAY_START);

    if (this.domops) {
      asyncDOM.invoke(this.domops);
    }

    this.root = document.getElementById('pagelet_' + this.id);
    this.setPhase(PAGELET_PHASE.DISPLAY_END);
    this.inform(PAGELET_EVENT.DISPLAY);
    this.bigPipe.pageletDisplayed(this);
  }
}
