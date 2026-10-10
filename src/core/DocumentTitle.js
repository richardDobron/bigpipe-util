import Arbiter from './Arbiter';

const BLINK_SPEED = 1500;

const titles = [];
let interval = null;
let index = 0;
let showingBlinkTitle = false;
let temporaryTitle = null;
let trueTitle = typeof document !== 'undefined' ? document.title : '';

function resetTitle() {
  DocumentTitle.set(temporaryTitle || trueTitle, true);
  showingBlinkTitle = false;
}

function blink() {
  if (titles.length === 0) {
    window.clearInterval(interval);
    interval = null;
    resetTitle();
    return;
  }

  if (showingBlinkTitle) {
    resetTitle();
  } else {
    document.title = titles[index].title;
    showingBlinkTitle = true;
    index = (index + 1) % titles.length;
  }
}

/**
 * The title of the page, which can blink with other titles, e.g. "New message".
 */
const DocumentTitle = {
  get() {
    return trueTitle;
  },

  /**
   * Sets the title and informs `update_title`. With `keep`, the title is temporary and the
   * true title stays, see get().
   */
  set(title, keep = false) {
    const text = String(title);
    document.title = text;

    if (keep) {
      temporaryTitle = text;
    } else {
      trueTitle = text;
      temporaryTitle = null;
      new Arbiter().inform('update_title', text);
    }
  },

  /**
   * Alternates the title with `title` every 1.5 seconds, also across page transitions, until
   * `stop()` of the returned object.
   */
  blink(title) {
    const entry = { title: String(title) };
    titles.push(entry);

    if (interval === null) {
      interval = window.setInterval(blink, BLINK_SPEED);
    }

    return {
      stop() {
        const position = titles.indexOf(entry);
        if (position === -1) {
          return;
        }

        titles.splice(position, 1);
        if (index > position) {
          index -= 1;
        } else if (index === position && index === titles.length) {
          index = 0;
        }
      }
    };
  }
};

export default DocumentTitle;
