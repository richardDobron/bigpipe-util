/**
 * Elects one tab of the same origin as the leader of a name, with the Web Locks API. The next tab
 * that asked becomes the leader when the leader releases it or is closed.
 */
const TabLeader = {
  isSupported() {
    return typeof navigator !== 'undefined' && Boolean(navigator.locks);
  },

  /**
   * Calls `onLead` once this tab is the leader. Returns `{ release() }`, which gives up the
   * leadership or stops waiting for it.
   */
  request(name, onLead) {
    const controller = new AbortController();
    let released = false;
    let unlock = null;

    navigator.locks
      .request('bigpipe-leader:' + name, { signal: controller.signal }, () => {
        if (released) {
          return undefined;
        }
        return new Promise(resolve => {
          unlock = resolve;
          onLead();
        });
      })
      .catch(() => {});

    return {
      release() {
        if (released) {
          return;
        }
        released = true;
        controller.abort();
        if (unlock) {
          unlock();
          unlock = null;
        }
      }
    };
  }
};

export default TabLeader;
