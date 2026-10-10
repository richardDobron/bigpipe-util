import Bootloader from '../Bootloader';
import ifRequired from './ifRequired';
import reportError from './reportError';

class RequireDeferredReference {
  constructor(name) {
    this.name = name;
  }

  getModuleId() {
    return this.name;
  }

  getModuleIfRequired() {
    return ifRequired(this.name, module => module);
  }

  preload() {
    Bootloader.preloadModules([this.name]);
  }

  load() {
    return new Promise((resolve, reject) => {
      Bootloader.loadModules([this.name], resolve, reject);
    });
  }

  loadImmediately(callback) {
    Bootloader.loadModules([this.name], callback);
  }

  onReady(callback) {
    let removed = false;

    this.load().then(module => {
      if (!removed) {
        callback(module);
      }
    }, reportError);

    return {
      remove() {
        removed = true;
      }
    };
  }
}

export default function requireDeferred(name) {
  return new RequireDeferredReference(name);
}
