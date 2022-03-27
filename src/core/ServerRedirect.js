export default class ServerRedirect {
  redirectPageTo(url, delay = 0) {
    setTimeout(function () {
      window.location = url;
    }, delay);
  }
}
