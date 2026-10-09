export default function onAfterLoad(callback) {
  if (document.readyState === 'complete') {
    setTimeout(callback, 0);
  } else {
    window.addEventListener('load', () => callback(), { capture: true, once: true });
  }
}
