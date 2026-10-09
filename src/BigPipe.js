import { BIGPIPE_PHASE, PAGELET_PHASE, RESOURCE_PHASE } from './BigPipePhases';
import Pagelet from './Pagelet';
import getCSPNonce from './core/getCSPNonce';

export { BIGPIPE_PHASE, PAGELET_PHASE, RESOURCE_PHASE };

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
  }

  onPageletArrive(pageletData) {
    if (pageletData.is_last) {
      this.setPhase(BIGPIPE_PHASE.READY_FOR_JS);
    }

    const pagelet = new Pagelet(pageletData, this);
    this.registerPagelet(pagelet);
    pagelet.start();
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

  areAllPageletsReady() {
    if (this.pagelets.size === 0) {
      return false;
    }

    return Array.from(this.pagelets.values()).every(
      pagelet => pagelet.phase >= PAGELET_PHASE.ARRIVE_END
    );
  }

  pageletDisplayed() {
    if (!this.areAllPageletsReady()) {
      return;
    }

    if (this.phase === BIGPIPE_PHASE.READY_FOR_JS) {
      this.loadJSResources();
    }
  }

  setPhase(newPhase) {
    this.phase = newPhase;
  }

  loadJSResources() {
    this.setPhase(BIGPIPE_PHASE.LOADING_JS);

    const jsResources = this.getResourcesByType('js');

    jsResources.forEach(resource => {
      resource.startLoading();
    });

    this.notifyPageletsWithoutResources();

    if (jsResources.length === 0) {
      this.notifyAllPagelets();
    }
  }

  getResourcesByType(type) {
    return Array.from(this.pageletResources.values()).filter(resource => resource.type === type);
  }

  notifyPageletsWithoutResources() {
    this.pagelets.forEach(pagelet => {
      if (pagelet.jsResources.size === 0) {
        pagelet.onJsFinished();
      }
    });
  }

  notifyAllPagelets() {
    this.pagelets.forEach(pagelet => {
      pagelet.onJsFinished();
    });
  }

  resolveResourceName(file) {
    try {
      return new URL(file, document.baseURI).href;
    } catch (e) {
      return file;
    }
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
