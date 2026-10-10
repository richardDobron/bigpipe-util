import Bootloader from '../Bootloader';
import requireModule from './requireModule';

export default function ifRequired(name, whenLoaded, whenMissing) {
  let module;

  try {
    if (Bootloader.isLoaded(name)) {
      module = requireModule(name);
    }
  } catch (error) {
    module = undefined;
  }

  if (module === undefined) {
    return whenMissing ? whenMissing() : undefined;
  }

  return whenLoaded ? whenLoaded(module) : undefined;
}
