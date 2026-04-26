/**
 * Shared types for the `dbx_notification_m_validate_folder` validator.
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
 */

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

export type ViolationSeverity = 'error' | 'warning';

export interface Violation {
  readonly code: ViolationCode;
  readonly severity: ViolationSeverity;
  readonly message: string;
  readonly side: 'component' | 'api';
  readonly file: string | undefined;
}

export interface ValidationResult {
  readonly violations: readonly Violation[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly componentDir: string;
  readonly apiDir: string;
}

export type SideStatus = 'ok' | 'dir-not-found' | 'folder-missing';

/**
 * Inspection of one side (component or API) of the notification area.
 * The validator wrapper populates {@link files}, {@link entries}, and
 * {@link indexSource} via `node:fs/promises`; specs build inspections
 * directly without touching the disk.
 */
export interface SideInspection {
  /**
   * Side name. Used in violation messages.
   */
  readonly side: 'component' | 'api';
  /**
   * Path supplied by the caller (e.g. `components/demo-firebase`).
   */
  readonly rootDir: string;
  /**
   * Relative path of the notification folder under {@link rootDir}, e.g. `src/lib/model/notification`.
   */
  readonly subPath: string;
  readonly status: SideStatus;
  /**
   * `.ts` file basenames at the notification folder root.
   */
  readonly files: readonly string[];
  /**
   * Direct subdirectory names at the notification folder root (used to flag `handlers/`).
   */
  readonly entries: readonly string[];
  /**
   * Contents of `index.ts` when present at the folder root; `undefined` otherwise.
   */
  readonly indexSource: string | undefined;
}

export interface NotificationFolderInspection {
  readonly componentDir: string;
  readonly apiDir: string;
  readonly component: SideInspection;
  readonly api: SideInspection;
}

/**
 * Required file at the API root for a notification folder. The
 * validator emits the corresponding {@link RequiredApiFile.code}
 * error naming the file when it is absent.
 */
export interface RequiredApiFile {
  readonly filename: string;
  readonly code: Extract<ViolationCode, `NOTIF_FOLDER_${string}_FILE_MISSING`>;
  readonly role: string;
}

export const REQUIRED_API_FILES: readonly RequiredApiFile[] = [
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
