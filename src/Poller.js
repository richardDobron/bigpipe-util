import AsyncRequest from './async/AsyncRequest';
import AsyncResponse from './async/AsyncResponse';
import Arbiter from './core/Arbiter';
import TabLeader from './core/TabLeader';
import { setTimeout, clearTimeout, setTimeoutAcrossTransitions } from './core/TimerStorage';
import UserActivity from './core/UserActivity';
import Visibility from './core/Visibility';
import emptyFunction from './core/emptyFunction';
import { defineInstance } from './core/requireModule';

/**
 * Sends a request again and again, e.g. to check for new notifications. Every request is set up by
 * `setupRequest(request, poller)`, or sent to `uri` with `data`, whose response is applied like
 * any other. The next request is sent `interval` milliseconds (at least 2 seconds) after the last
 * one finished.
 */
export default class Poller {
  static MIN_INTERVAL = 2000;

  /**
   * With an `id`, the server can control the poller: its requests send the `__poller` parameter,
   * and a response can call its methods as the module of that id, e.g. `[id, 'setInterval', [60000]]`.
   */
  constructor(options = {}) {
    this.config = {
      clearOnQuicklingEvents: true,
      setupRequest: emptyFunction,
      interval: null,
      maxRequests: Infinity,
      dontStart: false,
      uri: null,
      method: 'GET',
      data: {},
      id: null,
      muteWhenHidden: true,
      muteWhenIdle: 0,
      shareAcrossTabs: false,
      ...options
    };
    this.handle = null;
    this.requests = 0;
    this.muted = false;
    this.polling = false;
    this.skipNext = false;
    this.cancelRequest = emptyFunction;
    this.listeners = {};
    this.subscriptions = [];
    this.channel = null;
    this.leadership = null;
    this.leader = true;

    if (this.config.id) {
      defineInstance(this.config.id, () => this);
    }

    this.watch();

    if (!this.config.dontStart) {
      this.start();
    }
  }

  watch() {
    const { muteWhenHidden, muteWhenIdle, clearOnQuicklingEvents } = this.config;

    if (muteWhenHidden && Visibility.isSupported()) {
      this.subscriptions.push(
        Visibility.subscribe(Visibility.HIDDEN, () => this.mute()),
        Visibility.subscribe(Visibility.VISIBLE, () => this.resume())
      );
      if (Visibility.isHidden()) {
        this.muted = true;
      }
    }

    if (muteWhenIdle > 0) {
      this.subscriptions.push(
        UserActivity.subscribe(() => {
          if (!(muteWhenHidden && Visibility.isHidden())) {
            this.resume();
          }
        })
      );
    }

    if (clearOnQuicklingEvents) {
      this.subscriptions.push(new Arbiter().subscribe('Quickling/unload', () => this.destroy()));
    }

    this.share();
  }

  /**
   * With `shareAcrossTabs`, only the leader of the tabs with a poller of the same name, `id` or
   * `uri` sends requests, and the other tabs apply its responses. A hidden tab is not the leader.
   */
  share() {
    const { shareAcrossTabs, id, uri, muteWhenHidden } = this.config;
    const name = shareAcrossTabs === true ? uri || id : shareAcrossTabs;

    if (!name || !TabLeader.isSupported() || typeof BroadcastChannel === 'undefined') {
      return;
    }

    this.leader = false;
    this.channel = new BroadcastChannel('bigpipe-poller:' + name);
    this.channel.onmessage = ({ data }) => {
      if (!this.leader && data && data.response) {
        new AsyncResponse().handle(this.adopt(data.response, data.id));
      }
    };

    const hides = muteWhenHidden && Visibility.isSupported();
    if (hides) {
      this.subscriptions.push(
        Visibility.subscribe(Visibility.HIDDEN, () => this.lead(false, name)),
        Visibility.subscribe(Visibility.VISIBLE, () => this.lead(true, name))
      );
    }

    this.subscriptions.push({
      remove: () => {
        this.lead(false, name);
        this.channel.close();
        this.channel = null;
      }
    });

    this.lead(!(hides && Visibility.isHidden()), name);
  }

  // Calls of the response to the poller of the leader are for this one.
  adopt(response, leaderId) {
    const calls = response.jsmods && response.jsmods.require;
    if (leaderId && Array.isArray(calls)) {
      response.jsmods.require = calls
        .filter(call => call[0] !== leaderId || this.config.id)
        .map(call => (call[0] === leaderId ? [this.config.id, ...call.slice(1)] : call));
    }
    return response;
  }

  lead(wanted, name) {
    if (wanted && !this.leadership) {
      this.leadership = TabLeader.request(name, () => {
        this.leader = true;
        if (this.polling && this.handle === null) {
          this.request();
        }
      });
    } else if (!wanted && this.leadership) {
      this.leadership.release();
      this.leadership = null;
      this.leader = false;
    }
  }

  isLeader() {
    return this.leader;
  }

  start() {
    if (this.polling) {
      return this;
    }
    this.requests = 0;
    return this.request();
  }

  stop() {
    this.cancelRequest();
    return this;
  }

  /**
   * Stops the poller for good, also its reactions to the visibility of the page and the activity
   * of the user. A page transition destroys it, unless `clearOnQuicklingEvents` is false.
   */
  destroy() {
    this.stop();
    this.subscriptions.splice(0).forEach(subscription => subscription.remove());
    return this;
  }

  mute() {
    this.muted = true;
    return this;
  }

  resume() {
    if (this.muted) {
      this.muted = false;
      if (this.handle === null && this.polling) {
        return this.request();
      }
    }
    return this;
  }

  /**
   * Skips the next request, the poller goes on with the one after it.
   */
  skip() {
    this.skipNext = true;
    return this;
  }

  reset() {
    return this.stop().start();
  }

  request() {
    this.cancelRequest();
    this.polling = true;

    const { muteWhenIdle } = this.config;
    if (muteWhenIdle > 0 && !UserActivity.isActive(muteWhenIdle)) {
      this.muted = true;
    }

    if (this.muted || !this.leader) {
      return this;
    }

    this.requests += 1;
    if (this.requests > this.config.maxRequests) {
      return this.done();
    }

    const request = new AsyncRequest().setAllowCrossPageTransition(
      !this.config.clearOnQuicklingEvents
    );
    let canceled = false;

    const { uri, method, data, id } = this.config;
    if (uri) {
      request
        .setURI(uri)
        .setMethod(method)
        .setData(id ? { ...data, __poller: id } : data);
    }

    // The finally handler schedules the next request: one set by setupRequest runs before it
    // instead of replacing it.
    let finallyHandler = emptyFunction;
    request.setFinallyHandler(transport => {
      try {
        finallyHandler(transport);
      } finally {
        if (!canceled) {
          this.setupNextRequest();
        }
      }
    });
    request.setFinallyHandler = handler => {
      finallyHandler = handler || emptyFunction;
      return request;
    };

    this.cancelRequest = () => {
      canceled = true;
      request.abandon();
      this.cleanup();
    };

    this.config.setupRequest(request, this);

    if (this.channel) {
      const { preResponseHandler } = request;
      request.setPreResponseHandler(response => {
        const result = preResponseHandler ? preResponseHandler(response) : undefined;
        if (result !== false && !response.error && this.channel) {
          this.channel.postMessage({
            response: JSON.parse(JSON.stringify(response)),
            id: this.config.id
          });
        }
        return result;
      });
    }

    if (this.skipNext) {
      this.skipNext = false;
      setTimeoutAcrossTransitions(() => {
        if (!canceled) {
          this.setupNextRequest();
        }
      }, 0);
    } else {
      request.send();
    }

    return this;
  }

  isPolling() {
    return this.polling;
  }

  isMuted() {
    return this.muted;
  }

  /**
   * Changes the interval of the next requests, also from the server.
   */
  setInterval(interval) {
    if (interval) {
      this.config.interval = interval;
      this.start();
    }
    return this;
  }

  getInterval() {
    return this.config.interval;
  }

  /**
   * Calls `callback` when the poller stops after `maxRequests`. Returns a subscription whose
   * `remove()` stops it.
   */
  subscribe(event, callback) {
    const listeners = (this.listeners[event] = this.listeners[event] || []);
    listeners.push(callback);
    return {
      remove: () => {
        const index = listeners.indexOf(callback);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  setupNextRequest() {
    if (!this.polling) {
      return;
    }

    if (this.requests >= this.config.maxRequests) {
      this.done();
      return;
    }

    let { interval } = this.config;
    interval = typeof interval === 'function' ? interval(this.requests) : interval;
    interval = Math.max(interval || 0, Poller.MIN_INTERVAL);

    const schedule = this.config.clearOnQuicklingEvents ? setTimeout : setTimeoutAcrossTransitions;
    this.handle = schedule(() => {
      this.handle = null;
      this.request();
    }, interval);
  }

  cleanup() {
    if (this.handle !== null) {
      clearTimeout(this.handle);
    }
    this.handle = null;
    this.cancelRequest = emptyFunction;
    this.polling = false;
  }

  done() {
    this.cleanup();
    (this.listeners.done || []).slice().forEach(callback => callback({ sender: this }));
    return this;
  }
}
