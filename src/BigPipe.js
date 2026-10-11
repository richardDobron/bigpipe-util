import { BIGPIPE_EVENT, BIGPIPE_PHASE, PAGELET_EVENT, PAGELET_PHASE } from './BigPipePhases';
import Bootloader from './Bootloader';
import Pagelet from './Pagelet';
import Arbiter from './core/Arbiter';
import { find } from './core/Parent';
import onAfterLoad from './core/onAfterLoad';
import performanceNow from './core/performanceNow';
import reportError from './core/reportError';

export { BIGPIPE_EVENT, BIGPIPE_PHASE, PAGELET_EVENT, PAGELET_PHASE };

let instance = null;

// The pagelets of the page are the group `null`, unless a page transition starts another page. The
// pagelets of a response, e.g. a lazy pagelet, are a group of their own: they load their JS once all
// of them are displayed, and do not count for the events of the page.
const PAGE = null;

export default class BigPipe {
  pagelets = new Map();
  phase = BIGPIPE_PHASE.WAITING;
  ttiPhase = null;
  ttiReached = false;
  lastArrived = false;
  pageGroup = PAGE;
  groups = new Map();

  constructor() {
    if (instance) {
      return instance;
    }
    instance = this;
    this.inform(BIGPIPE_EVENT.INIT);
  }

  /**
   * Informs a page event through Arbiter as a state, so a later subscriber gets it too.
   */
  inform(event, data = {}) {
    if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
      performance.mark(event);
    }

    new Arbiter().informState(event, { ts: performanceNow(), ...data });
  }

  /**
   * Starts a pagelet. A pagelet that fails to arrive is reported and does not stop the page.
   * `group` tells the response the pagelet came with, see AsyncResponse; the pagelets of the page
   * have none.
   */
  onPageletArrive(pageletData, group = PAGE) {
    try {
      this.arrive(pageletData, group);
    } catch (error) {
      reportError(error);
    }
  }

  /**
   * Starts the next page of a page transition: the pagelets of the response `group` are the page.
   */
  startPage(group) {
    this.pageGroup = group;
    this.groups.delete(group);
    this.setPhase(BIGPIPE_PHASE.WAITING);
    this.resetTti();
  }

  isPage(group) {
    return group === this.pageGroup;
  }

  getGroupPagelets(group) {
    return Array.from(this.pagelets.values()).filter(pagelet => pagelet.group === group);
  }

  arrive(pageletData, group = PAGE) {
    if (pageletData.resource_map) {
      Bootloader.setResourceMap(pageletData.resource_map);
    }

    if (pageletData.bootloadable) {
      Bootloader.enableBootload(pageletData.bootloadable);
    }

    if (pageletData.tti_phase !== undefined && pageletData.tti_phase !== null) {
      this.ttiPhase = Number(pageletData.tti_phase);
    }

    if (pageletData.is_last) {
      if (this.isPage(group)) {
        this.setPhase(BIGPIPE_PHASE.READY_FOR_JS);
        this.lastArrived = true;
      } else {
        this.groups.set(group, { lastArrived: true, jsStarted: false });
      }
    }

    const previous = this.pagelets.get(pageletData.id);
    if (previous) {
      this.removePagelet(previous);
    }

    const pagelet = new Pagelet(pageletData, this);
    pagelet.group = group;
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

    find(node, el => {
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

  areAllPageletsDisplayed(group = this.pageGroup) {
    const pagelets = this.getGroupPagelets(group);

    if (pagelets.length === 0) {
      return false;
    }

    return pagelets.every(pagelet => pagelet.phase >= PAGELET_PHASE.DISPLAY_END);
  }

  /**
   * Whether the pagelet may be displayed: after the pagelets of a lower `phase` that arrived with
   * it, and after its `display_dependency`, the pagelets it has to be displayed after.
   */
  canDisplay(pagelet) {
    const isDisplayed = other => other.phase >= PAGELET_PHASE.DISPLAY_END;

    return (
      this.getGroupPagelets(pagelet.group).every(
        other => other.displayPhase >= pagelet.displayPhase || isDisplayed(other)
      ) &&
      pagelet.displayDependency.every(id => {
        const dependency = this.pagelets.get(id);
        return dependency && isDisplayed(dependency);
      })
    );
  }

  displayWaitingPagelets() {
    this.pagelets.forEach(pagelet => pagelet.display());
  }

  pageletDisplayed(pagelet) {
    this.displayWaitingPagelets();
    this.checkTti();

    if (pagelet && !this.isPage(pagelet.group)) {
      this.loadGroupJSResources(pagelet.group);
      return;
    }

    if (this.phase === BIGPIPE_PHASE.READY_FOR_JS && this.areAllPageletsDisplayed()) {
      this.loadJSResources();
    }
  }

  /**
   * Loads the JS files of the pagelets of a response once its last pagelet arrived and all of
   * them are displayed.
   */
  loadGroupJSResources(group) {
    const state = this.groups.get(group);

    if (!state || state.jsStarted || !this.areAllPageletsDisplayed(group)) {
      return;
    }

    state.jsStarted = true;
    this.getGroupPagelets(group).forEach(pagelet => pagelet.startJs());
  }

  /**
   * Informs `tti_bigpipe` once every pagelet of the phases up to `tti_phase` is displayed and no
   * more of them can arrive, then loads the JS files of the later phases in the background.
   */
  checkTti() {
    if (this.ttiReached || this.ttiPhase === null) {
      return;
    }

    const pagelets = this.getGroupPagelets(this.pageGroup);
    const complete =
      this.lastArrived || pagelets.some(pagelet => pagelet.displayPhase > this.ttiPhase);
    const isEarly = pagelet => pagelet.displayPhase <= this.ttiPhase;

    if (
      !complete ||
      !pagelets.filter(isEarly).every(pagelet => pagelet.phase >= PAGELET_PHASE.DISPLAY_END)
    ) {
      return;
    }

    this.ttiReached = true;
    this.inform(BIGPIPE_EVENT.TTI, { phase: this.ttiPhase });
    pagelets.filter(pagelet => !isEarly(pagelet)).forEach(pagelet => pagelet.prefetchJs());
  }

  /**
   * Forgets the time to interactive of the page, for the next page of a page transition.
   */
  resetTti() {
    this.ttiPhase = null;
    this.ttiReached = false;
    this.lastArrived = false;
    new Arbiter().clearState(BIGPIPE_EVENT.TTI);
  }

  pageletFinished(pagelet) {
    const group = pagelet ? pagelet.group : this.pageGroup;
    const pagelets = this.getGroupPagelets(group);

    if (!pagelets.every(other => other.isComplete())) {
      return;
    }

    if (!this.isPage(group)) {
      this.groups.delete(group);
    } else if (this.phase === BIGPIPE_PHASE.LOADING_JS) {
      this.setPhase(BIGPIPE_PHASE.COMPLETE);
      this.inform(BIGPIPE_EVENT.LOADED);
    } else {
      return;
    }

    onAfterLoad(() => {
      pagelets.forEach(other => {
        other.processAfterLoadJsMods();
      });
    });
  }

  setPhase(newPhase) {
    this.phase = newPhase;
  }

  loadJSResources() {
    this.inform(BIGPIPE_EVENT.DISPLAYED);
    this.setPhase(BIGPIPE_PHASE.LOADING_JS);

    this.getGroupPagelets(this.pageGroup).forEach(pagelet => {
      pagelet.startJs();
    });

    this.pageletFinished();
  }

  fileLoaded(file) {
    Bootloader.done(file);
  }

  resolveResourceName(file) {
    return Bootloader.resolveURL(file);
  }
}
