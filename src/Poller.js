import AsyncRequest from './async/AsyncRequest';
import Arbiter from './core/Arbiter';
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
      this.subscriptions.push(new Arbiter().subscribe('onload/exit', () => this.destroy()));
    }
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

    if (this.muted) {
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

    request.setFinallyHandler(() => {
      if (!canceled) {
        this.setupNextRequest();
      }
    });

    this.cancelRequest = () => {
      canceled = true;
      request.abandon();
      this.cleanup();
    };

    this.config.setupRequest(request, this);

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
