const _events = {};

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
        window.setTimeout(() => {
          throw e;
        }, 0);
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
    const list = this.getSubscribers(toWhat);
    list.push(withWhat);
    return this;
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
