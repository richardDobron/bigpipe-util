import invariant from './invariant';

const BUILTIN_PREFIX = /^bigpipe-util\/(?:(?:src|dist)\/)?/;

const registered = new Map();
const builtins = new Map();
let loader = null;

export function setModuleLoader(fn) {
  if (fn !== null && typeof fn !== 'function') {
    throw new TypeError('BigPipe: the module loader has to be a function or null.');
  }
  loader = fn;
}

export function registerModules(modules) {
  Object.keys(modules).forEach(name => registered.set(name, modules[name]));
}

export function registerBuiltins(modules) {
  Object.keys(modules).forEach(name => builtins.set(name, modules[name]));
}

export default function requireModule(name) {
  if (registered.has(name)) {
    return registered.get(name);
  }

  if (BUILTIN_PREFIX.test(name)) {
    const builtin = builtins.get(name.replace(BUILTIN_PREFIX, ''));
    if (builtin !== undefined) {
      return builtin;
    }
  }

  if (loader) {
    const resolved = loader(name);
    invariant(
      resolved !== undefined && resolved !== null,
      'BigPipe: module "%s" was not found by the module loader.',
      name
    );
    return resolved;
  }

  if (typeof window !== 'undefined' && typeof window.require === 'function') {
    if (window.require !== requireModule) {
      return window.require(name);
    }
  }

  invariant(
    false,
    'BigPipe: cannot resolve module "%s". Call setModuleLoader() from ' +
      "'bigpipe-util/dist/ModuleRegistry' (or define window.require) first.",
    name
  );
}
