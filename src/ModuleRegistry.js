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
import TimerStorage from './core/TimerStorage';
import waitForLoad from './core/waitForLoad';
import BigPipe from './BigPipe';
import Bootloader, { requireLazy } from './Bootloader';
import Pagelet from './Pagelet';
import PageTransitions from './PageTransitions';
import MorePagerFetchOnScroll from './MorePagerFetchOnScroll';
import Primer from './Primer';
import Quickling from './Quickling';
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
  'core/TimerStorage': TimerStorage,
  'core/waitForLoad': waitForLoad,
  BigPipe,
  Bootloader,
  MorePagerFetchOnScroll,
  Pagelet,
  PageTransitions,
  Primer,
  Quickling,
  ServerJS,
  UIPagelet
});

export function setModuleLoader(loader, { global = true } = {}) {
  setLoader(loader);

  if (global && typeof window !== 'undefined') {
    window.require = requireModule;
  }
}

export { registerModules, requireLazy, requireModule };
