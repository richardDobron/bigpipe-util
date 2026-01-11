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
    const Pagelet = require("./Pagelet").default;

    if (pageletData.is_last) {
      this.setPhase(BIGPIPE_PHASE.READY_FOR_JS);
    }

    const pagelet = new Pagelet(pageletData);
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
      pagelet => pagelet.phase >= 3
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
    return Array.from(this.pageletResources.values())
      .filter(resource => resource.type === type);
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

  extractFilename(filePath) {
    const match = /([^/]+)$/.exec(filePath);
    return match ? match[1] : filePath;
  }

  pageletResourceFactory(file, type) {
    const name = this.extractFilename(file);

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

        if (type === 'css') {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = file;
          link.onload = () => self.fileLoaded(name);
          link.onerror = () => self.fileLoaded(name);
          document.head.appendChild(link);
        } else if (type === 'js') {
          const script = document.createElement('script');
          script.src = file;
          script.onload = () => self.fileLoaded(name);
          script.onerror = () => self.fileLoaded(name);
          document.body.appendChild(script);
        }
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
