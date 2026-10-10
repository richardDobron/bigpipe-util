import {
  BIGPIPE_EVENT,
  BIGPIPE_PHASE,
  PAGELET_EVENT,
  PAGELET_PHASE,
  RESOURCE_PHASE
} from './BigPipePhases';
import Pagelet from './Pagelet';
import Arbiter from './core/Arbiter';
import { find } from './core/Parent';
import onAfterLoad from './core/onAfterLoad';
import getCSPNonce from './core/getCSPNonce';
import performanceNow from './core/performanceNow';

export { BIGPIPE_EVENT, BIGPIPE_PHASE, PAGELET_EVENT, PAGELET_PHASE, RESOURCE_PHASE };

let instance = null;

export default class BigPipe {
  pageletResources = new Map();
  pagelets = new Map();
  phase = BIGPIPE_PHASE.WAITING;

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
  inform(event) {
    if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
      performance.mark(event);
    }

    new Arbiter().informState(event, { ts: performanceNow() });
  }

  onPageletArrive(pageletData) {
    if (pageletData.is_last) {
      this.setPhase(BIGPIPE_PHASE.READY_FOR_JS);
    }

    const previous = this.pagelets.get(pageletData.id);
    if (previous) {
      this.removePagelet(previous);
    }

    const pagelet = new Pagelet(pageletData, this);
    this.registerPagelet(pagelet);
    pagelet.start();
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

  fileLoaded(filename) {
    const resource = this.pageletResources.get(filename);
    if (resource) {
      resource.onComplete();
    }
  }

  registerPagelet(pagelet) {
    this.pagelets.set(pagelet.id, pagelet);
  }

  areAllPageletsDisplayed() {
    if (this.pagelets.size === 0) {
      return false;
    }

    return Array.from(this.pagelets.values()).every(
      pagelet => pagelet.phase >= PAGELET_PHASE.DISPLAY_END
    );
  }

  /**
   * Whether the pagelet may be displayed: after the pagelets of a lower `phase` that arrived, and
   * after its `display_dependency`, the pagelets it has to be displayed after.
   */
  canDisplay(pagelet) {
    const isDisplayed = other => other.phase >= PAGELET_PHASE.DISPLAY_END;

    return (
      Array.from(this.pagelets.values()).every(
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

  pageletDisplayed() {
    this.displayWaitingPagelets();

    if (this.phase === BIGPIPE_PHASE.READY_FOR_JS && this.areAllPageletsDisplayed()) {
      this.loadJSResources();
    }
  }

  pageletFinished() {
    if (this.phase !== BIGPIPE_PHASE.LOADING_JS) {
      return;
    }

    if (!Array.from(this.pagelets.values()).every(pagelet => pagelet.isComplete())) {
      return;
    }

    this.setPhase(BIGPIPE_PHASE.COMPLETE);
    this.inform(BIGPIPE_EVENT.LOADED);

    onAfterLoad(() => {
      this.pagelets.forEach(pagelet => {
        pagelet.processAfterLoadJsMods();
      });
    });
  }

  setPhase(newPhase) {
    this.phase = newPhase;
  }

  loadJSResources() {
    this.inform(BIGPIPE_EVENT.DISPLAYED);
    this.setPhase(BIGPIPE_PHASE.LOADING_JS);

    this.getResourcesByType('js').forEach(resource => {
      resource.startLoading();
    });

    // Pagelets without JS files (or with files already loaded) get no callback from a resource.
    this.pagelets.forEach(pagelet => {
      pagelet.startJs();
    });
  }

  resolveResourceName(file) {
    try {
      return new URL(file, document.baseURI).href;
    } catch (e) {
      return file;
    }
  }

  getResourcesByType(type) {
    return Array.from(this.pageletResources.values()).filter(resource => resource.type === type);
  }

  extractFilename(filePath) {
    const match = /([^/]+)$/.exec(filePath);
    return match ? match[1] : filePath;
  }

  pageletResourceFactory(file, type) {
    const name = this.resolveResourceName(file);

    let resource = this.pageletResources.get(name);
    if (!resource) {
      resource = this.createResource(file, name, type);
      this.pageletResources.set(name, resource);
    }

    return resource;
  }

  createResource(file, name, type) {
    const self = this;

    return {
      file,
      name,
      type,
      phase: RESOURCE_PHASE.PENDING,
      callbacks: [],

      startLoading() {
        if (this.phase !== RESOURCE_PHASE.PENDING) {
          return;
        }

        this.phase = RESOURCE_PHASE.LOADING;

        let element;
        if (type === 'css') {
          element = document.createElement('link');
          element.rel = 'stylesheet';
          element.href = file;
        } else if (type === 'js') {
          element = document.createElement('script');
          element.src = file;
        } else {
          return;
        }

        const nonce = getCSPNonce();
        if (nonce) {
          element.setAttribute('nonce', nonce);
        }

        element.onload = () => self.fileLoaded(name);
        element.onerror = () => self.fileLoaded(name);
        (type === 'css' ? document.head : document.body).appendChild(element);
      },

      onComplete() {
        this.phase = RESOURCE_PHASE.LOADED;
        this.callbacks.forEach(callback => callback(this));
      },

      attachToPagelet(callback) {
        this.callbacks.push(callback);
      }
    };
  }
}
