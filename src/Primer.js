import AsyncRequest from "./async/AsyncRequest";
import {byTag} from "./core/Parent";

export default function Primer() {
  const rootElement = document.documentElement;

  const RELATIONSHIP_REGEX = /async(?:-post)?|dialog/;

  rootElement.onclick = function (event) {
    event = event || window.event;
    const elementOnClicked = event.target || event.srcElement;

    const linkNodeOnClicked = byTag(elementOnClicked, "A");

    if (!linkNodeOnClicked) {
      return;
    }

    const ajaxHref = linkNodeOnClicked.getAttribute("ajaxify")
    const realHref = linkNodeOnClicked.href
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

    switch (relationship) {
      case "async":
      case "async-post":
        event.preventDefault();

        (new AsyncRequest(ajaxHref))
          .setRelative(linkNodeOnClicked)
          .setInitialHandler(() => {
            linkNodeOnClicked.classList.add("async-saving");
          })
          .setHandler(() => {
            linkNodeOnClicked.classList.remove("async-saving");
          })
          .setErrorHandler(() => {
            linkNodeOnClicked.classList.remove("async-saving");
          })
          .setMethod(relationship === "async-post" ? "POST" : "GET")
          .send();
        break;
      case "dialog":
        event.preventDefault();

        (new AsyncRequest(linkNodeOnClicked.getAttribute("ajaxify")))
          .setRelative(linkNodeOnClicked)
          .setInitialHandler(() => {
            linkNodeOnClicked.classList.add("async-saving");
          })
          .setHandler(() => {
            linkNodeOnClicked.classList.remove("async-saving");
          })
          .setErrorHandler(() => {
            linkNodeOnClicked.classList.remove("async-saving");
          })
          .setMethod("POST")
          .send();
        break;
    }
  };

  rootElement.onsubmit = function (event) {
    event = event || window.event;
    const eventTarget = event.target || event.srcElement;

    if (eventTarget &&
      eventTarget.nodeName === "FORM" &&
      eventTarget.getAttribute("rel") === "async") {
      event.preventDefault();

      const submitter = event.submitter || eventTarget.querySelector("button[type='submit']"),
        activeControls = eventTarget.querySelectorAll("input:not([readonly]),select:not([readonly]),textarea:not([readonly])");

      (new AsyncRequest(eventTarget.getAttribute("ajaxify") || eventTarget.getAttribute("action")))
        .setMethod(eventTarget.method || "POST")
        .setRelative(eventTarget)
        .setData(new FormData(eventTarget))
        .setInitialHandler(function () {
          eventTarget.classList.add("async-saving");

          if (!eventTarget.classList.contains("disable-prevent-form")) {
            activeControls.forEach(function (control) {
              control.setAttribute("readonly", "readonly");
            });

            if (submitter) {
              submitter.disabled = true;
            }
          }

          if (eventTarget) {
            const loader = eventTarget.querySelector(".form-loader");

            if (loader) {
              loader.classList.add("loading");
            }
          }
        })
        .setHandler(function (response) {
          eventTarget.classList.remove("async-saving");

          activeControls.forEach(function (control) {
            control.removeAttribute("readonly");
          });

          if (submitter) {
            submitter.disabled = false;
          }

          if (eventTarget) {
            const loader = eventTarget.querySelector(".small-loader");

            if (loader) {
              loader.classList.remove("loading");
            }
          }
        })
        .setErrorHandler(function () {
          eventTarget.classList.add("async-saving");

          activeControls.forEach(function (control) {
            control.removeAttribute("readonly");
          });

          if (eventTarget) {
            const loader = eventTarget.querySelector(".small-loader");

            if (loader) {
              loader.classList.remove("loading");
            }
          }
        })
        .send();
    }
  };
}
