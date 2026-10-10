import Arbiter from '../Arbiter';
import HideSources from './HideSources';

export default class HideOnTransition {
  constructor(layer) {
    this.layer = layer;
    this.subscription = null;
  }

  enable() {
    this.subscription = new Arbiter().subscribe('pre_page_transition', transition => {
      if (this.isTransitionRelevant(transition)) {
        this.layer.hide(HideSources.TRANSITION);
      }
    });
  }

  disable() {
    this.subscription.remove();
    this.subscription = null;
  }

  isTransitionRelevant() {
    return true;
  }
}
