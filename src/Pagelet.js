import { PAGELET_PHASE, PAGELET_EVENT } from './BigPipePhases';
import Bootloader from './Bootloader';
import ServerJS from './ServerJS';
import AsyncDOM from './async/AsyncDOM';
import Arbiter from './core/Arbiter';
import DOM from './core/DOM';
import invariant from './core/invariant';
import performanceNow from './core/performanceNow';
import reportError from './core/reportError';

const serverJS = new ServerJS();
const asyncDOM = new AsyncDOM();

function loadResources(groups, callback) {
  let pending = groups.length;

  groups.forEach(([names, type]) =>
    Bootloader.loadResources(
      names || [],
      () => {
        pending -= 1;
        if (pending === 0) {
          callback();
        }
      },
      type
    )
  );
}

export { PAGELET_PHASE, PAGELET_EVENT };

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
    this.onload = pageletData.onload;
    this.onafterload = pageletData.onafterload;
    this.displayPhase = pageletData.phase || 0;
    this.displayDependency = pageletData.display_dependency || [];
    this.css = pageletData.css;
    this.js = pageletData.js;
    this.displayResources = pageletData.displayResources || [];
    this.allResources = pageletData.allResources || [];
    this.jsNonBlock = Boolean(pageletData.jsNonBlock);
    this.prefetchRsrcs = pageletData.prefetchRsrcs || [];
    this.prefetchJsmods = pageletData.prefetchJsmods;
    this.root = null;
    this.error = null;
    this.destroyed = false;
    this.cssLoaded = false;
    this.jsStarted = false;
    this.jsPrefetched = false;
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

    this.inform(PAGELET_EVENT.ARRIVE);
    this.prefetch();

    this.setPhase(PAGELET_PHASE.LOADING_CSS);
    this.inform(PAGELET_EVENT.CSS);
    loadResources([[this.css, 'css'], [this.displayResources]], () => this.onCssFinished());
  }

  /**
   * Loads the `prefetchRsrcs` of the pagelet when it arrives and then handles its `prefetchJsmods`,
   * e.g. for what the user is likely to need next.
   */
  prefetch() {
    if (this.prefetchRsrcs.length === 0 && !this.prefetchJsmods) {
      return;
    }

    Bootloader.loadResources(this.prefetchRsrcs, () => {
      if (!this.destroyed && this.prefetchJsmods) {
        serverJS.handle(this.prefetchJsmods);
      }
    });
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
   * Loads the JS files of the pagelet: BigPipe calls it when every pagelet is displayed, or the
   * pagelet itself once it is displayed with `jsNonBlock`.
   */
  startJs() {
    if (this.destroyed || this.phase !== PAGELET_PHASE.DISPLAY_END || this.jsStarted) {
      return;
    }

    this.jsStarted = true;
    this.inform(PAGELET_EVENT.JS_START);
    loadResources([[this.js, 'js'], [this.allResources]], () => this.onJsFinished());
  }

  prefetchJs() {
    if (this.jsPrefetched || this.jsStarted || this.destroyed) {
      return;
    }

    this.jsPrefetched = true;
    Bootloader.prefetch([...(this.js || []), ...this.allResources]);
  }

  onJsFinished() {
    if (this.destroyed || this.phase !== PAGELET_PHASE.DISPLAY_END || !this.jsStarted) {
      return;
    }

    this.inform(PAGELET_EVENT.JS_DONE);
    this.processOnloadJsMods();

    this.setPhase(PAGELET_PHASE.ARRIVE_END);
    this.inform(PAGELET_EVENT.ONLOAD);
    this.bigPipe.pageletFinished(this);
  }

  processJsMods() {
    if (this.jsmods) {
      serverJS.handle(this.jsmods);
    }
  }

  /**
   * Handles the `onload` jsmods, the module calls that need the JS files of the pagelet.
   */
  processOnloadJsMods() {
    if (this.onload) {
      serverJS.handle(this.onload);
    }
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
    if (this.destroyed || this.cssLoaded || this.phase !== PAGELET_PHASE.LOADING_CSS) {
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

  /**
   * Reports an error of the pagelet and informs `pagelet/error`, e.g. to show an error state in
   * it. The page goes on: the pagelet still counts as displayed and runs its modules.
   */
  fail(error) {
    this.error = error;
    reportError(error);
    new Arbiter().inform('pagelet/error', { id: this.id, error });
  }

  setContent() {
    this.setPhase(PAGELET_PHASE.DISPLAY_START);
    this.inform(PAGELET_EVENT.DISPLAY_START);

    if (this.domops) {
      try {
        asyncDOM.invoke(this.domops);
      } catch (error) {
        this.fail(error);
      }
    }

    this.root = document.getElementById('pagelet_' + this.id);
    this.processJsMods();
    this.setPhase(PAGELET_PHASE.DISPLAY_END);
    this.inform(PAGELET_EVENT.DISPLAY);

    if (this.jsNonBlock) {
      this.startJs();
    }

    this.bigPipe.pageletDisplayed(this);
  }
}
