import { BIGPIPE_EVENT } from '../BigPipePhases';
import Arbiter from './Arbiter';
import requireModule, { isModuleDefined } from './requireModule';

/**
 * The module with the revision of the deploy the page comes from, which the PHP library defines
 * after BigPipe::setRevision(). Every response carries the revision of the server too.
 */
export const REVISION_MODULE = 'BigPipeRevision';

let newRevision = null;

/**
 * Compares the revision of a response with the one of the page. When the server has a new deploy,
 * it informs `BigPipe/newRevision` once, e.g. to offer to reload the page, and the next page
 * transition loads the page in full, with the new scripts.
 */
export function checkRevision(revision) {
  if (newRevision !== null || revision === undefined || revision === null) {
    return;
  }

  if (!isModuleDefined(REVISION_MODULE)) {
    return;
  }

  const page = requireModule(REVISION_MODULE);

  if (page !== null && page !== undefined && String(page) !== String(revision)) {
    newRevision = String(revision);
    new Arbiter().informState(BIGPIPE_EVENT.NEW_REVISION, {
      revision: newRevision,
      page: String(page)
    });
  }
}

/**
 * Whether the server has a newer deploy than the page, see checkRevision().
 */
export function isOutdated() {
  return newRevision !== null;
}
