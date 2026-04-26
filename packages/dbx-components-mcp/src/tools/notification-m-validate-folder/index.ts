/**
 * Public entry points for the notification-folder validator. Wires the
 * shared two-side folder engine with this domain's labels, paths, and
 * `'NOTIF_FOLDER_*'` literal codes; exposes the original public API
 * (`validateNotificationFolder`, `inspectNotificationFolder`,
 * `formatResult`) so tool wrappers and specs stay unchanged.
 */

import { createTwoSideFolderValidator } from '../validate-two-side-folder.js';
import { API_NOTIFICATION_SUBPATH, CANONICAL_API_ROOT_FILES, COMPONENT_NOTIFICATION_SUBPATH, HANDLERS_SUBFOLDER_NAME, INDEX_FILE, NOTIFICATION_FILE_PREFIX, REQUIRED_API_FILES, type ViolationCode } from './types.js';

const notificationFolderValidator = createTwoSideFolderValidator<ViolationCode>({
  fileLabel: 'Notification',
  lowerLabel: 'notification',
  filePrefix: NOTIFICATION_FILE_PREFIX,
  componentSubPath: COMPONENT_NOTIFICATION_SUBPATH,
  apiSubPath: API_NOTIFICATION_SUBPATH,
  handlersSubfolderName: HANDLERS_SUBFOLDER_NAME,
  indexFile: INDEX_FILE,
  requiredApiFiles: REQUIRED_API_FILES,
  canonicalApiRootFiles: CANONICAL_API_ROOT_FILES,
  codes: {
    componentDirNotFound: 'NOTIF_FOLDER_COMPONENT_DIR_NOT_FOUND',
    apiDirNotFound: 'NOTIF_FOLDER_API_DIR_NOT_FOUND',
    componentFolderMissing: 'NOTIF_FOLDER_COMPONENT_FOLDER_MISSING',
    apiFolderMissing: 'NOTIF_FOLDER_API_FOLDER_MISSING',
    barrelReexportMissing: 'NOTIF_FOLDER_BARREL_REEXPORT_MISSING',
    unexpectedFileName: 'NOTIF_FOLDER_UNEXPECTED_FILE_NAME',
    handlersSubfolderMixed: 'NOTIF_FOLDER_HANDLERS_SUBFOLDER_MIXED'
  }
});

export const inspectNotificationFolder = notificationFolderValidator.inspect;
export const validateNotificationFolder = notificationFolderValidator.validate;

export { formatResult } from './format.js';
export type { NotificationFolderInspection, SideInspection, ValidationResult, Violation, ViolationCode, ViolationSeverity } from './types.js';
