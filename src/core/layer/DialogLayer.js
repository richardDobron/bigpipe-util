import DestroyOnHide from './DestroyOnHide';
import { calculateTopMargin } from './DialogPosition';
import Layer from './Layer';
import { getTabbable } from './focusWithinLayer';

export default class DialogLayer extends Layer {
  constructor(modal, config = {}) {
    super(modal.el, config);

    this.modal = modal;
    this.hideModal = modal.hide;
    this.onResize = () => this.updatePosition();

    modal.layer = this;
    modal.hide = () => {
      this.hide();
      return modal;
    };

    modal.on('show', () => this.onModalShow());
    modal.on('shown', () => this.inform('aftershow'));
    modal.on('hidden', () => this.onModalHidden());
  }

  getDefaultBehaviors() {
    return [DestroyOnHide];
  }

  getFocusRoot() {
    const body = this.root.querySelector('.modal-body');
    return body && getTabbable(body).length ? body : this.root;
  }

  show() {
    if (!this.shown) {
      this.modal.show();
    }
    return this;
  }

  finishHide() {
    if (this.shown) {
      this.hideModal.call(this.modal);
    }
  }

  onModalShow() {
    this.inform('beforeshow');
    this.markShown();

    window.addEventListener('resize', this.onResize);
    Promise.resolve().then(() => this.updatePosition());
  }

  onModalHidden() {
    window.removeEventListener('resize', this.onResize);
    this.markHidden();
  }

  updatePosition() {
    const { position } = this.config;

    if (!position || !this.shown) {
      return true;
    }

    const dialog = this.root.firstElementChild || this.root;
    const options = position === true ? {} : position;

    dialog.style.marginTop = `${calculateTopMargin(dialog.offsetHeight, options)}px`;

    return true;
  }
}
