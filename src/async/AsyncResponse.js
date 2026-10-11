import AsyncDOM from './AsyncDOM';
import BigPipe from '../BigPipe';
import Bootloader from '../Bootloader';
import ServerJS from '../ServerJS';

const _AsyncDOM = new AsyncDOM();
const _ServerJS = new ServerJS();

export default class AsyncResponse {
  /**
   * Applies a response. `group` tells the request it answers, e.g. the number of an AsyncRequest:
   * the pagelets of a response load their JS together, see BigPipe.
   */
  handle(response, element, group = Symbol('response')) {
    if (response !== null && typeof response === 'object') {
      const { domops, pagelets, jsmods } = response;
      const bigPipe = new BigPipe();

      if (response.resource_map) {
        Bootloader.setResourceMap(response.resource_map);
      }

      if (response.bootloadable) {
        Bootloader.enableBootload(response.bootloadable);
      }

      if (domops) {
        _AsyncDOM.invoke(domops, element);
        bigPipe.destroyDetachedPagelets();
      }

      if (pagelets) {
        pagelets.forEach(pagelet => bigPipe.onPageletArrive(pagelet, group));
      }

      if (jsmods) {
        _ServerJS.handle(jsmods, element instanceof Element ? element : null);
      }
    }
  }
}
