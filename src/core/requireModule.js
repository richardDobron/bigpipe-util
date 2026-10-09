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
    if (resolved === undefined || resolved === null) {
      throw new Error(`BigPipe: module "${name}" was not found by the module loader.`);
    }
    return resolved;
  }

  if (typeof window !== 'undefined' && typeof window.require === 'function') {
    if (window.require !== requireModule) {
      return window.require(name);
    }
  }

  throw new Error(
    `BigPipe: cannot resolve module "${name}". Call setModuleLoader() from ` +
      `'bigpipe-util/dist/ModuleRegistry' (or define window.require) first.`
  );
}
