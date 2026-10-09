import reportError from './reportError';

const _events = Object.create(null);
const _states = Object.create(null);

function call(context, callback, args) {
  try {
    callback.apply(context, args);
  } catch (e) {
    reportError(e);
  }
}

export default class Arbiter {
  constructor() {
    this._events = _events;
  }

  inform(what, ...args) {
    [...this.getSubscribers(what)].forEach(callback => call(this, callback, args));
    return this;
  }

  informState(what, ...args) {
    _states[what] = args;
    return this.inform(what, ...args);
  }

  clearState(what) {
    delete _states[what];
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

    if (_states[toWhat]) {
      call(this, withWhat, _states[toWhat]);
    }

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
