import AsyncDOM from "./AsyncDOM";
import ServerJS from "../ServerJS";

const _AsyncDOM = new AsyncDOM;
const _ServerJS = new ServerJS;

export default class AsyncResponse {
  handle(response, element) {
    const {domops, jsmods} = response;

    if (typeof response === 'object') {
      if (domops) {
        _AsyncDOM.invoke(domops, element);
      }

      if (jsmods) {
        _ServerJS.handle(jsmods);
      }
    }
  }
};
