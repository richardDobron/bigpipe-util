import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncDOM from '../AsyncDOM';

// The markers of an HTML comment, apart: a module may not contain them as they are.
const OPEN = '<' + '!--';
const CLOSE = '--' + '>';

beforeEach(() => {
  document.body.innerHTML = '<div id="pagelet_feed"></div>';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// What the PHP library prints for the HTML of a pagelet, see BigPipe::setHtmlContainers().
function printContainer(id, html) {
  const escaped = html.replace(/\\/g, '\\\\').replace(/-/g, '\\-');
  document.body.insertAdjacentHTML(
    'beforeend',
    `<code hidden id="${id}">${OPEN} ${escaped} ${CLOSE}</code>`
  );
}

describe('HTML containers', () => {
  it('takes the HTML of a DOM operation from its container and removes the container', () => {
    const html = `<p class="post-1">A -- B ${CLOSE} C ${OPEN} a comment ${CLOSE} \\n</p>`;
    printContainer('u_0_1', html);

    new AsyncDOM().invoke([['setContent', '#pagelet_feed', false, { __container: 'u_0_1' }]]);

    expect(document.getElementById('pagelet_feed').innerHTML).toBe(
      `<p class="post-1">A -- B --&gt; C ${OPEN} a comment ${CLOSE} \\n</p>`
    );
    expect(document.getElementById('u_0_1')).toBeNull();
  });

  it('inserts nothing for a container that is not on the page', () => {
    vi.stubGlobal('__DEV__', true);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    new AsyncDOM().invoke([['appendContent', '#pagelet_feed', false, { __container: 'u_0_9' }]]);

    expect(document.getElementById('pagelet_feed').innerHTML).toBe('');
    expect(consoleError).toHaveBeenCalledWith(
      "Warning: BigPipe: the HTML container 'u_0_9' is not on the page."
    );
    consoleError.mockRestore();
  });
});
