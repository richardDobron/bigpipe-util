import AsyncDOM from './async/AsyncDOM';
import AsyncRequest from './async/AsyncRequest';
import AsyncResponse from './async/AsyncResponse';
import $ from './core/$';
import Arbiter from './core/Arbiter';
import Dialog from './core/Dialog';
import Cookie from './core/Cookie';
import DataStore from './core/DataStore';
import DOM from './core/DOM';
import DocumentTitle from './core/DocumentTitle';
import ifRequired from './core/ifRequired';
import KeyEventController from './core/KeyEventController';
import onAfterLoad from './core/onAfterLoad';
import ReloadPage from './core/ReloadPage';
import requireCond from './core/requireCond';
import requireDeferred from './core/requireDeferred';
import Run from './core/Run';
import ServerRedirect from './core/ServerRedirect';
import TimerStorage from './core/TimerStorage';
import UserActivity from './core/UserActivity';
import Visibility from './core/Visibility';
import WebStorage from './core/WebStorage';
import BigPipe from './BigPipe';
import Bootloader, { requireLazy } from './Bootloader';
import Pagelet from './Pagelet';
import Poller from './Poller';
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
  'core/Cookie': Cookie,
  'core/DataStore': DataStore,
  'core/DOM': DOM,
  'core/DocumentTitle': DocumentTitle,
  'core/ifRequired': ifRequired,
  'core/KeyEventController': KeyEventController,
  'core/onAfterLoad': onAfterLoad,
  'core/ReloadPage': ReloadPage,
  'core/requireCond': requireCond,
  'core/requireDeferred': requireDeferred,
  'core/Run': Run,
  'core/ServerRedirect': ServerRedirect,
  'core/TimerStorage': TimerStorage,
  'core/UserActivity': UserActivity,
  'core/Visibility': Visibility,
  'core/WebStorage': WebStorage,
  BigPipe,
  Bootloader,
  MorePagerFetchOnScroll,
  Pagelet,
  PageTransitions,
  Poller,
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

export { ifRequired, registerModules, requireCond, requireDeferred, requireLazy, requireModule };
