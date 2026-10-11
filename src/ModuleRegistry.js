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
import Form from './core/Form';
import FormMonitor from './core/FormMonitor';
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
import AutoFocus from './core/layer/AutoFocus';
import ContextualLayer from './core/layer/ContextualLayer';
import DestroyOnHide from './core/layer/DestroyOnHide';
import FadeOnHide from './core/layer/FadeOnHide';
import FadeOnShow from './core/layer/FadeOnShow';
import HideOnBlur from './core/layer/HideOnBlur';
import HideOnEscape from './core/layer/HideOnEscape';
import HideOnSuccess from './core/layer/HideOnSuccess';
import HideOnTransition from './core/layer/HideOnTransition';
import Layer from './core/layer/Layer';
import ModalLayer from './core/layer/ModalLayer';
import RefocusOnHide from './core/layer/RefocusOnHide';
import RemoveOnHide from './core/layer/RemoveOnHide';
import TabIsolation from './core/layer/TabIsolation';
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
  'core/Form': Form,
  'core/FormMonitor': FormMonitor,
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
  'core/layer/AutoFocus': AutoFocus,
  'core/layer/ContextualLayer': ContextualLayer,
  'core/layer/DestroyOnHide': DestroyOnHide,
  'core/layer/FadeOnHide': FadeOnHide,
  'core/layer/FadeOnShow': FadeOnShow,
  'core/layer/HideOnBlur': HideOnBlur,
  'core/layer/HideOnEscape': HideOnEscape,
  'core/layer/HideOnSuccess': HideOnSuccess,
  'core/layer/HideOnTransition': HideOnTransition,
  'core/layer/Layer': Layer,
  'core/layer/ModalLayer': ModalLayer,
  'core/layer/RefocusOnHide': RefocusOnHide,
  'core/layer/RemoveOnHide': RemoveOnHide,
  'core/layer/TabIsolation': TabIsolation,
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
