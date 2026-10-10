import AsyncDOM from './AsyncDOM';
import BigPipe from '../BigPipe';
import Bootloader from '../Bootloader';
import ServerJS from '../ServerJS';

const _AsyncDOM = new AsyncDOM();
const _ServerJS = new ServerJS();

export default class AsyncResponse {
  handle(response, element) {
    const { domops, pagelets, jsmods } = response;

    if (typeof response === 'object') {
      const bigPipe = new BigPipe();

      if (response.resource_map) {
        Bootloader.setResourceMap(response.resource_map);
      }

      if (domops) {
        _AsyncDOM.invoke(domops, element);
        bigPipe.destroyDetachedPagelets();
      }

      if (pagelets) {
        pagelets.forEach(pagelet => bigPipe.onPageletArrive(pagelet));
      }

      if (jsmods) {
        _ServerJS.handle(jsmods);
      }
    }
  }
}
