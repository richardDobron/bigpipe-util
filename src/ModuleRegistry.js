import AsyncDOM from './async/AsyncDOM';
import AsyncRequest from './async/AsyncRequest';
import AsyncResponse from './async/AsyncResponse';
import $ from './core/$';
import Arbiter from './core/Arbiter';
import Dialog from './core/Dialog';
import DOM from './core/DOM';
import onAfterLoad from './core/onAfterLoad';
import ReloadPage from './core/ReloadPage';
import ServerRedirect from './core/ServerRedirect';
import waitForLoad from './core/waitForLoad';
import BigPipe from './BigPipe';
import Pagelet from './Pagelet';
import Primer from './Primer';
import ServerJS from './ServerJS';
import UIPagelet from './UIPagelet';
import requireModule, {
  registerBuiltins,
  registerModules,
  setModuleLoader as setLoader
} from './core/requireModule';

registerBuiltins({
  'async/AsyncDOM': AsyncDOM,
  'async/AsyncRequest': AsyncRequest,
  'async/AsyncResponse': AsyncResponse,
  'core/$': $,
  'core/Arbiter': Arbiter,
  'core/Dialog': Dialog,
  'core/DOM': DOM,
  'core/onAfterLoad': onAfterLoad,
  'core/ReloadPage': ReloadPage,
  'core/ServerRedirect': ServerRedirect,
  'core/waitForLoad': waitForLoad,
  BigPipe,
  Pagelet,
  Primer,
  ServerJS,
  UIPagelet
});

export function setModuleLoader(loader, { global = true } = {}) {
  setLoader(loader);

  if (global && typeof window !== 'undefined') {
    window.require = requireModule;
  }
}

export { registerModules, requireModule };
