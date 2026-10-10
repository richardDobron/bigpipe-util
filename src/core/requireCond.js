import requireModule from './requireModule';

export default function requireCond(condition, whenTrue, whenFalse) {
  return requireModule(condition ? whenTrue : whenFalse);
}
