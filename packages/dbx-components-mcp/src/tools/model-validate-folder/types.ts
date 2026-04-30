/**
 * Shared types for the `dbx_validate_model_folder` validator.
 *
 * The validator takes one or more folder paths and asserts that each is
 * a canonical model folder: contains `<name>.ts`, `<name>.id.ts`,
 * `<name>.query.ts`, `<name>.action.ts`, `<name>.api.ts`, and
 * `index.ts`. Stray `.ts` files at the folder root that don't start
 * with `<name>.` are warned about.
 *
 * Reserved folder names (like `system`, `notification`, `storagefile`)
 * either follow a distinct layout or are imported from the upstream
 * `@dereekb/firebase` package. Those are skipped with a warning and
 * defer to their dedicated validators.
 */

import type { FolderGroupedResult, FolderGroupedViolation } from '../validate-format.js';
import type { ModelValidateFolderCode } from './codes.js';

export type { FolderInspectionStatus, ViolationSeverity } from '../validate-format.js';

/**
 * String-literal union derived from {@link ModelValidateFolderCode}.
 */
export type ViolationCode = `${ModelValidateFolderCode}`;

export type Violation = FolderGroupedViolation<ViolationCode>;

export type ValidationResult = FolderGroupedResult<Violation>;

/**
 * Descriptor for a reserved model-folder name — one that the validator
 * recognizes but deliberately skips because the folder either follows a
 * distinct layout (e.g. `system/`) or is an extension of an upstream
 * group imported from `@dereekb/firebase` (e.g. `notification/`,
 * `storagefile/`). The emitted warning points the caller at the
 * dedicated validator for that group.
 */
export interface ReservedModelFolder {
  readonly name: string;
  readonly reason: string;
  readonly recommendedTool: string;
}

/**
 * Folder names reserved from the canonical 5-file check. The validator
 * emits a {@link RESERVED_MODEL_FOLDER} warning naming the
 * {@link ReservedModelFolder.recommendedTool} instead of running
 * structural rules.
 */
export const RESERVED_MODEL_FOLDERS: readonly ReservedModelFolder[] = [
  {
    name: 'system',
    reason: 'System-state folder uses a distinct minimal layout (`system.ts` + `index.ts` required; optional `system.action.ts`/`system.api.ts`) with project-specific state-type declarations.',
    recommendedTool: 'dbx_system_m_validate_folder'
  },
  {
    name: 'notification',
    reason: 'Notification is a canonical group from `@dereekb/firebase` with a richer layout than the base 5 files (task, send, config, message, etc.); downstream projects extend rather than redeclare it.',
    recommendedTool: 'dbx_notification_m_validate_folder'
  },
  {
    name: 'storagefile',
    reason: 'StorageFile is a canonical group from `@dereekb/firebase` with a richer layout than the base 5 files (group, upload, file, etc.); downstream projects extend rather than redeclare it.',
    recommendedTool: 'dbx_storagefile_m_validate_folder'
  }
];

/**
 * One folder inspection result passed into the pure rules core. The MCP
 * tool populates this via `node:fs/promises` before calling into the
 * validator. Specs build fixtures directly without touching the disk.
 */
export interface FolderInspection {
  /**
   * Display name for the folder (typically the last path segment).
   */
  readonly name: string;
  /**
   * Original path as provided by the caller (used in violation messages).
   */
  readonly path: string;
  readonly status: FolderInspectionStatus;
  /**
   * `.ts` file basenames at the folder root (ignored when `status !== 'ok'`).
   */
  readonly files: readonly string[];
}

/**
 * Canonical file suffixes required inside each model folder. `index`
 * is the odd one out — no `<name>.` prefix.
 */
export interface RequiredFile {
  readonly filename: string;
  readonly code: Extract<ViolationCode, `FOLDER_MISSING_${string}`>;
  readonly role: string;
}

/**
 * Returns the canonical list of files required inside a `<name>` model folder.
 * Centralised here so the folder rules and any future scaffolders share the
 * same shape without drift.
 *
 * @param name - the model folder's basename
 * @returns the required files in the order rules surface them
 */
export function buildRequiredFiles(name: string): readonly RequiredFile[] {
  return [
    { filename: `${name}.ts`, code: 'FOLDER_MISSING_MAIN', role: 'main model' },
    { filename: `${name}.id.ts`, code: 'FOLDER_MISSING_ID', role: 'id types' },
    { filename: `${name}.query.ts`, code: 'FOLDER_MISSING_QUERY', role: 'query helpers' },
    { filename: `${name}.action.ts`, code: 'FOLDER_MISSING_ACTION', role: 'model actions' },
    { filename: `${name}.api.ts`, code: 'FOLDER_MISSING_API', role: 'CRUD api' },
    { filename: 'index.ts', code: 'FOLDER_MISSING_INDEX', role: 'barrel export' }
  ];
}
