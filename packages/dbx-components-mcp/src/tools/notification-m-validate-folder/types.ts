/**
 * Domain types and constants for the
 * `dbx_notification_m_validate_folder` validator.
 *
 * The validator takes two directory paths — a `-firebase` component
 * package and an API app — and asserts that the `notification/` model
 * folder on each side follows the downstream layout convention:
 *
 *   - Component side: `<componentDir>/src/lib/model/notification/`
 *     should contain `notification.ts` plus any optional split files
 *     (e.g. `notification.task.ts`); a barrel `index.ts` is optional.
 *   - API side: `<apiDir>/src/app/common/model/notification/` must
 *     contain `notification.module.ts`, `notification.task.service.ts`,
 *     and `notification.send.service.ts`. A `handlers/` subfolder is
 *     allowed for the multi-file split convention used by larger apps.
 *   - When an `index.ts` is present on either side, every `export *
 *     from './X'` clause must resolve locally — either to `./X.ts` or
 *     `./X/` (a folder with its own barrel).
 *
 * Cross-file wiring (whether each declared NotificationTemplateType
 * and NotificationTaskType is reachable from the metadata record /
 * service factory paths) is verified by the sibling validator
 * `dbx_notification_m_validate_app` and is not re-checked here.
 *
 * The structural types ({@link SideInspection},
 * {@link NotificationFolderInspection}, {@link Violation},
 * {@link ValidationResult}) are aliases of the shared
 * `validate-two-side-folder` engine specialised on this domain's
 * {@link ViolationCode} literal union.
 */

import type { RequiredApiFile, SideInspection as SharedSideInspection, TwoSideFolderInspection, TwoSideFolderValidationResult, TwoSideFolderViolation } from '../validate-two-side-folder.js';

export type { SideStatus, ViolationSeverity } from '../validate-two-side-folder.js';

export type ViolationCode =
  // I/O failures (errors)
  | 'NOTIF_FOLDER_COMPONENT_DIR_NOT_FOUND'
  | 'NOTIF_FOLDER_API_DIR_NOT_FOUND'
  | 'NOTIF_FOLDER_COMPONENT_FOLDER_MISSING'
  | 'NOTIF_FOLDER_API_FOLDER_MISSING'
  // API-side required files (errors)
  | 'NOTIF_FOLDER_MODULE_FILE_MISSING'
  | 'NOTIF_FOLDER_TASK_SERVICE_FILE_MISSING'
  | 'NOTIF_FOLDER_SEND_SERVICE_FILE_MISSING'
  // Barrel re-export resolution (errors)
  | 'NOTIF_FOLDER_BARREL_REEXPORT_MISSING'
  // Layout warnings
  | 'NOTIF_FOLDER_UNEXPECTED_FILE_NAME'
  | 'NOTIF_FOLDER_HANDLERS_SUBFOLDER_MIXED';

export type SideInspection = SharedSideInspection;
export type NotificationFolderInspection = TwoSideFolderInspection;
export type Violation = TwoSideFolderViolation<ViolationCode>;
export type ValidationResult = TwoSideFolderValidationResult<ViolationCode>;

export const REQUIRED_API_FILES: readonly RequiredApiFile<ViolationCode>[] = [
  { filename: 'notification.module.ts', code: 'NOTIF_FOLDER_MODULE_FILE_MISSING', role: 'NestJS notification module' },
  { filename: 'notification.task.service.ts', code: 'NOTIF_FOLDER_TASK_SERVICE_FILE_MISSING', role: 'NotificationTaskService factory' },
  { filename: 'notification.send.service.ts', code: 'NOTIF_FOLDER_SEND_SERVICE_FILE_MISSING', role: 'NotificationSendService factory' }
];

/**
 * API-root files considered canonical for the handlers-subfolder mix
 * warning. A `.ts` file at the API root that is not in this set (and
 * not `index.ts`) triggers `NOTIF_FOLDER_HANDLERS_SUBFOLDER_MIXED`
 * when a sibling `handlers/` directory is also present.
 *
 * Includes both the strictly-required files and the ancillary
 * convention files that ship alongside them in downstream projects:
 * Mailgun send wiring, init server-actions config, factory configs,
 * and the action context that exposes the notification services to
 * the rest of the app.
 */
export const CANONICAL_API_ROOT_FILES: readonly string[] = ['notification.module.ts', 'notification.task.service.ts', 'notification.send.service.ts', 'notification.send.mailgun.service.ts', 'notification.action.context.ts', 'notification.factory.ts', 'notification.init.ts', 'notification.mailgun.ts'];

export const NOTIFICATION_FILE_PREFIX = 'notification.';
export const COMPONENT_NOTIFICATION_SUBPATH = 'src/lib/model/notification';
export const API_NOTIFICATION_SUBPATH = 'src/app/common/model/notification';
export const HANDLERS_SUBFOLDER_NAME = 'handlers';
export const INDEX_FILE = 'index.ts';
