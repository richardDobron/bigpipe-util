export default class ReloadPage {
  now() {
    window.location.reload();
  }

  delay(delay) {
    setTimeout(this.now.bind(this), delay);
  }
}
