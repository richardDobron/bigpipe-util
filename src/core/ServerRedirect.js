import PageTransitions from '../PageTransitions';
import goOrReplace from './goOrReplace';
import { setTimeout } from './TimerStorage';

export default class ServerRedirect {
  /**
   * Loads the URL after `delay` milliseconds, unless the page is left meanwhile. `replace` replaces
   * the current history entry, and `transition` loads the page with a page transition when the
   * page has them on, see PageTransitions.
   */
  redirectPageTo(url, delay = 0, replace = false, transition = false) {
    setTimeout(() => {
      if (transition) {
        PageTransitions.go(url, replace);
      } else {
        goOrReplace(window.location, url, replace);
      }
    }, delay);
  }
}
