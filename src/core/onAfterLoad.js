import EventListener from 'fbjs/lib/EventListener';

export default function onAfterLoad(callback) {
  if (document.readyState === 'complete') {
    setTimeout(callback, 0);
  } else {
    const event = EventListener.capture(window, 'load', () => {
      event.remove();

      callback();
    });
  }
}
