import reportError from './reportError';

const _events = Object.create(null);

export default class Arbiter {
  constructor() {
    this._events = _events;
  }

  inform(what, ...args) {
    const list = [...this.getSubscribers(what)];
    for (let i = 0; i < list.length; i++) {
      if (list[i] === null) {
        continue;
      }

      try {
        list[i].apply(this, args);
      } catch (e) {
        reportError(e);
      }
    }
    return this;
  }

  getSubscribers(toWhat) {
    return this._events[toWhat] || (this._events[toWhat] = []);
  }

  clearSubscribers(toWhat) {
    if (toWhat) {
      this._events[toWhat] = [];
    }
    return this;
  }

  subscribe(toWhat, withWhat) {
    this.getSubscribers(toWhat).push(withWhat);

    let subscribed = true;
    return {
      remove: () => {
        if (subscribed) {
          subscribed = false;
          this.unsubscribe(toWhat, withWhat);
        }
      }
    };
  }

  unsubscribe(toWhat, withWhat) {
    const list = this.getSubscribers(toWhat);
    for (let i = 0; i < list.length; i++) {
      if (list[i] === withWhat) {
        list.splice(i, 1);
        break;
      }
    }
    return this;
  }
}
