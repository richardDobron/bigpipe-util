import AsyncRequest from './async/AsyncRequest';
import { byTag } from './core/Parent';

export default function Primer() {
  const rootElement = document.documentElement;

  const RELATIONSHIP_REGEX = /async(?:-post)?|dialog/;

  rootElement.addEventListener('click', function (event) {
    event = event || window.event;
    const elementOnClicked = event.target || event.srcElement;

    const linkNodeOnClicked = byTag(elementOnClicked, 'A');

    if (!linkNodeOnClicked) {
      return;
    }

    const ajaxHref = linkNodeOnClicked.getAttribute('ajaxify');
    const realHref = linkNodeOnClicked.href;
    let relationship = linkNodeOnClicked.rel && linkNodeOnClicked.rel.match(RELATIONSHIP_REGEX);
    relationship = relationship && relationship[0];

    if (ajaxHref && realHref && !/#$/.test(realHref)) {
      const isMiddleMouseButton = event.which && event.which === 2;
      const hasModifierKey = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;

      if (isMiddleMouseButton || hasModifierKey) {
        return;
      }
    }

    if (linkNodeOnClicked.classList.contains('async-saving')) {
      event.preventDefault();
      return;
    }

    if (relationship) {
      event.preventDefault();

      // No error handler: errors go to the default one, see AsyncRequest.setDefaultErrorHandler().
      new AsyncRequest(ajaxHref)
        .setRelative(linkNodeOnClicked)
        .setStatusElement(linkNodeOnClicked)
        .setMethod(relationship === 'async' ? 'GET' : 'POST')
        .send();
    }
  });

  rootElement.addEventListener('submit', function (event) {
    event = event || window.event;
    const eventTarget = event.target || event.srcElement;

    if (
      eventTarget &&
      eventTarget.nodeName === 'FORM' &&
      eventTarget.getAttribute('rel') === 'async'
    ) {
      event.preventDefault();

      const formData = new FormData(eventTarget);
      const submitter = event.submitter || eventTarget.querySelector("button[type='submit']");
      const activeControls = eventTarget.querySelectorAll(
        'input:not([readonly]),select:not([readonly]),textarea:not([readonly])'
      );

      if (submitter && submitter.name) {
        formData.append(submitter.name, submitter.value);
      }

      new AsyncRequest(eventTarget.getAttribute('ajaxify') || eventTarget.getAttribute('action'))
        .setMethod(eventTarget.method || 'POST')
        .setRelative(eventTarget)
        .setData(formData)
        .setStatusElement(eventTarget)
        .setInitialHandler(function () {
          if (!eventTarget.classList.contains('disable-prevent-form')) {
            activeControls.forEach(function (control) {
              control.setAttribute('readonly', 'readonly');
            });

            if (submitter) {
              submitter.disabled = true;
            }
          }

          if (eventTarget) {
            const loader = eventTarget.querySelector('.form-loader');

            if (loader) {
              loader.classList.add('loading');
            }
          }
        })
        .setFinallyHandler(function () {
          activeControls.forEach(function (control) {
            control.removeAttribute('readonly');
          });

          if (submitter) {
            submitter.disabled = false;
          }

          if (eventTarget) {
            const loader = eventTarget.querySelector('.form-loader');

            if (loader) {
              loader.classList.remove('loading');
            }
          }
        })
        .send();
    }
  });
}
