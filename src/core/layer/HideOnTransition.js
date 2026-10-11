import Arbiter from '../Arbiter';
import HideSources from './HideSources';

export default class HideOnTransition {
  constructor(layer) {
    this.layer = layer;
    this.subscription = null;
  }

  enable() {
    this.subscription = new Arbiter().subscribe('PageTransitions/beforeTransition', transition => {
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
