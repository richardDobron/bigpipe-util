import PageTransitions from '../PageTransitions';
import Arbiter from './Arbiter';
import onAfterLoadCallback from './onAfterLoad';
import reportError from './reportError';

const unloadHooks = new Set();
const beforeUnloadHooks = new Set();
let listening = false;

function guarded(hook) {
  try {
    return hook();
  } catch (error) {
    reportError(error);
    return undefined;
  }
}

function runAll(hooks) {
  Array.from(hooks).forEach(hook => {
    hooks.delete(hook);
    guarded(hook);
  });
}

function onNativeBeforeUnload(event) {
  if (PageTransitions.isLeaveConfirmed()) {
    return undefined;
  }

  const message = Array.from(beforeUnloadHooks, guarded).find(Boolean);
  if (message) {
    event.preventDefault();
    event.returnValue = message;
    return message;
  }

  return undefined;
}

function listen() {
  if (!listening && typeof window !== 'undefined') {
    listening = true;
    window.addEventListener('pagehide', () => runAll(unloadHooks));
    window.addEventListener('beforeunload', onNativeBeforeUnload);
  }
}

function once(callback) {
  let done = false;
  return () => {
    if (!done) {
      done = true;
      callback();
    }
  };
}

const Run = {
  onLoad(callback) {
    if (document.readyState !== 'loading') {
      guarded(callback);
      return { remove() {} };
    }

    const listener = () => guarded(callback);
    document.addEventListener('DOMContentLoaded', listener, { once: true });
    return { remove: () => document.removeEventListener('DOMContentLoaded', listener) };
  },

  onAfterLoad(callback) {
    let removed = false;
    onAfterLoadCallback(() => {
      if (!removed) {
        guarded(callback);
      }
    });
    return {
      remove() {
        removed = true;
      }
    };
  },

  onBeforeUnload(hook) {
    listen();
    beforeUnloadHooks.add(hook);
    const transitionHook = PageTransitions.addBeforeLeaveHook(hook);

    return {
      remove() {
        beforeUnloadHooks.delete(hook);
        transitionHook.remove();
      }
    };
  },

  onUnload(callback) {
    listen();
    unloadHooks.add(callback);
    return { remove: () => unloadHooks.delete(callback) };
  },

  onLeave(callback) {
    listen();
    const run = once(() => {
      unloadHooks.delete(run);
      transitionHook.remove();
      callback();
    });
    const transitionHook = PageTransitions.addLeaveHook(run);
    unloadHooks.add(run);

    return {
      remove() {
        unloadHooks.delete(run);
        transitionHook.remove();
      }
    };
  },

  onCleanupOrLeave(element, callback) {
    let leave;
    const destroyed = new Arbiter().subscribe('pagelet/destroy', ({ root }) => {
      if (root && element && root.contains(element)) {
        run();
      }
    });
    const run = once(() => {
      destroyed.remove();
      leave.remove();
      callback();
    });
    leave = Run.onLeave(run);

    return {
      remove() {
        destroyed.remove();
        leave.remove();
      }
    };
  }
};

export default Run;
