import HideSources from './HideSources';

export default class HideOnSuccess {
  constructor(layer) {
    this.layer = layer;
    this.listener = event => {
      const { hideOnSuccess } = this.layer.config;

      if (hideOnSuccess === true || (event.target.matches && event.target.matches(hideOnSuccess))) {
        this.layer.hide(HideSources.SUCCESS);
      }
    };
  }

  enable() {
    this.layer.getRoot().addEventListener('success', this.listener);
  }

  disable() {
    this.layer.getRoot().removeEventListener('success', this.listener);
  }
}
