import AsyncDOM from './AsyncDOM';
import BigPipe from '../BigPipe';
import ServerJS from '../ServerJS';

const _AsyncDOM = new AsyncDOM();
const _ServerJS = new ServerJS();

export default class AsyncResponse {
  handle(response, element) {
    const { domops, pagelets, jsmods } = response;

    if (typeof response === 'object') {
      if (domops) {
        _AsyncDOM.invoke(domops, element);
      }

      if (pagelets) {
        const bigPipe = new BigPipe();
        pagelets.forEach(pagelet => bigPipe.onPageletArrive(pagelet));
      }

      if (jsmods) {
        _ServerJS.handle(jsmods);
      }
    }
  }
}
