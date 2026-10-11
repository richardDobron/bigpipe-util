import BigPipe from './BigPipe';
import ServerJS from './ServerJS';
import reportError from './core/reportError';

/**
 * The global the inline scripts of the page push their calls to, so they work before the
 * entrypoint is loaded: `(window.__bigpipe = window.__bigpipe || []).push(['arrive', pagelet])`.
 */
export const QUEUE = '__bigpipe';

const serverJS = new ServerJS();

const calls = {
  // A pagelet, see BigPipe.onPageletArrive().
  arrive: pagelet => new BigPipe().onPageletArrive(pagelet),
  // The modules of the page, see ServerJS.handle().
  handle: jsmods => serverJS.handle(jsmods)
};

function run(call) {
  try {
    const [name, payload] = call;
    const method = Object.prototype.hasOwnProperty.call(calls, name) ? calls[name] : null;

    if (!method) {
      throw new Error(`BigPipe: unknown call "${name}" in window.${QUEUE}.`);
    }

    method(payload);
  } catch (error) {
    reportError(error);
  }
}

/**
 * Runs the calls the page queued before the entrypoint was loaded, in their order, and every later
 * call right away. ModuleRegistry starts it once the entrypoint has run, so the module loader is set.
 */
export default function processQueue() {
  const queue = window[QUEUE];

  if (queue && queue.processing) {
    return;
  }

  const pending = Array.isArray(queue) ? queue : [];

  window[QUEUE] = {
    processing: true,
    push(...items) {
      items.forEach(run);
      return items.length;
    }
  };

  pending.forEach(run);
}
