import DOM from "../core/DOM";

export default class AsyncDOM {
  invoke(domOps, element) {
    for (let i = 0; i < domOps.length; ++i) {
      let domOp = domOps[i],
        type = domOp[0],
        selector = domOp[1],
        enableTarget = domOp[2],
        content = domOp[3];

      let node = enableTarget && element || null;

      if (selector) {
        node = (node || document.documentElement).querySelector(selector);
      }

      switch (type) {
        case "eval":
          (new Function(content)).apply(node);
          break;
        case "hide":
          node.style.display = "none";
          break;
        case "show":
          node.style.display = "";
          break;
        case "setContent":
          DOM.setContent(node, content.__html);
          break;
        case "appendContent":
          DOM.appendContent(node, content.__html);
          break;
        case "prependContent":
          DOM.prependContent(node, content.__html);
          break;
        case "insertAfter":
          DOM.insertAfter(node, content.__html);
          break;
        case "insertBefore":
          DOM.insertBefore(node, content.__html);
          break;
        case "remove":
          DOM.remove(node);
          break;
        case "replace":
          DOM.replace(node, content.__html);
      }
    }
  }
};
