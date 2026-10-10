import BigPipe from './BigPipe';
import onVisible from './core/onVisible';
import warning from './core/warning';

/**
 * Clicks a "See more" link handled by the Primer when it comes within `offset` pixels of the
 * viewport, so the next page of a list loads while the user scrolls. The server calls it for a
 * `dobron\BigPipe\MorePager`.
 */
export default class MorePagerFetchOnScroll {
  constructor(element, offset = 0, setup = true) {
    this.element = element;
    this.offset = offset;
    this.subscription = null;

    warning(element, 'MorePagerFetchOnScroll: the pager is not on the page.');

    if (!element) {
      return;
    }

    const pagelet = new BigPipe().getPageletForNode(element);
    if (pagelet) {
      pagelet.addDestructor(() => this.remove());
    }

    if (setup) {
      this.setup();
    }
  }

  setup() {
    this.remove();
    this.subscription = onVisible(this.element, () => this.element.click(), {
      buffer: this.offset
    });
  }

  remove() {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
  }
}
