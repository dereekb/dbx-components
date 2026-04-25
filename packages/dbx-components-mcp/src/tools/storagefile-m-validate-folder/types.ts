/**
 * Shared types for the `dbx_storagefile_m_validate_folder` validator.
 *
 * The validator takes two directory paths — a `-firebase` component
 * package and an API app — and asserts that the `storagefile/` model
 * folder on each side follows the downstream layout convention:
 *
 *   - Component side: `<componentDir>/src/lib/model/storagefile/`
 *     should contain `storagefile.ts` (or split files prefixed
 *     `storagefile.`); a barrel `index.ts` is optional.
 *   - API side: `<apiDir>/src/app/common/model/storagefile/` must
 *     contain `storagefile.module.ts`, `storagefile.upload.service.ts`,
 *     and `storagefile.init.ts`. A `handlers/` subfolder is allowed for
 *     the multi-file split convention.
 *   - When an `index.ts` is present on either side, every `export *
 *     from './X'` clause must resolve locally — either to `./X.ts` or
 *     `./X/` (a folder with its own barrel).
 *
 * Cross-file wiring (whether each declared purpose is reachable from
 * the upload service / processing handler) is verified by the
 * sibling validator `dbx_storagefile_m_validate_app` and is not
 * re-checked here.
 */

export type ViolationCode =
  // I/O failures (errors)
  | 'STORAGEFILE_FOLDER_COMPONENT_DIR_NOT_FOUND'
  | 'STORAGEFILE_FOLDER_API_DIR_NOT_FOUND'
  | 'STORAGEFILE_FOLDER_COMPONENT_FOLDER_MISSING'
  | 'STORAGEFILE_FOLDER_API_FOLDER_MISSING'
  // API-side required files (errors)
  | 'STORAGEFILE_FOLDER_UPLOAD_SERVICE_FILE_MISSING'
  | 'STORAGEFILE_FOLDER_MODULE_FILE_MISSING'
  | 'STORAGEFILE_FOLDER_INIT_FILE_MISSING'
  // Barrel re-export resolution (errors)
  | 'STORAGEFILE_FOLDER_BARREL_REEXPORT_MISSING'
  // Layout warnings
  | 'STORAGEFILE_FOLDER_UNEXPECTED_FILE_NAME'
  | 'STORAGEFILE_FOLDER_HANDLERS_SUBFOLDER_MIXED';

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
 * Inspection of one side (component or API) of the storagefile area.
 * The validator wrapper populates {@link files}, {@link entries}, and
 * {@link indexSource} via `node:fs/promises`; specs build inspections
 * directly without touching the disk.
 */
export interface SideInspection {
  /** Side name. Used in violation messages. */
  readonly side: 'component' | 'api';
  /** Path supplied by the caller (e.g. `components/demo-firebase`). */
  readonly rootDir: string;
  /** Relative path of the storagefile folder under {@link rootDir}, e.g. `src/lib/model/storagefile`. */
  readonly subPath: string;
  readonly status: SideStatus;
  /** `.ts` file basenames at the storagefile folder root. */
  readonly files: readonly string[];
  /** Direct subdirectory names at the storagefile folder root (used to flag `handlers/`). */
  readonly entries: readonly string[];
  /** Contents of `index.ts` when present at the folder root; `undefined` otherwise. */
  readonly indexSource: string | undefined;
}

export interface StorageFileFolderInspection {
  readonly componentDir: string;
  readonly apiDir: string;
  readonly component: SideInspection;
  readonly api: SideInspection;
}

/**
 * Required file at the API root for a storagefile folder. The
 * validator emits the corresponding {@link RequiredApiFile.code} error
 * naming the file when it is absent.
 */
export interface RequiredApiFile {
  readonly filename: string;
  readonly code: Extract<ViolationCode, `STORAGEFILE_FOLDER_${string}_FILE_MISSING`>;
  readonly role: string;
}

export const REQUIRED_API_FILES: readonly RequiredApiFile[] = [
  { filename: 'storagefile.upload.service.ts', code: 'STORAGEFILE_FOLDER_UPLOAD_SERVICE_FILE_MISSING', role: 'upload-service factory' },
  { filename: 'storagefile.module.ts', code: 'STORAGEFILE_FOLDER_MODULE_FILE_MISSING', role: 'NestJS storage-file module' },
  { filename: 'storagefile.init.ts', code: 'STORAGEFILE_FOLDER_INIT_FILE_MISSING', role: 'storage-file init server actions config' }
];

/**
 * API-root files considered canonical for the handlers-subfolder mix
 * warning. A `.ts` file at the API root that is not in this set (and
 * not `index.ts`) triggers `STORAGEFILE_FOLDER_HANDLERS_SUBFOLDER_MIXED`
 * when a sibling `handlers/` directory is also present.
 */
export const CANONICAL_API_ROOT_FILES: readonly string[] = ['storagefile.module.ts', 'storagefile.upload.service.ts', 'storagefile.init.ts'];

export const STORAGEFILE_FILE_PREFIX = 'storagefile.';
export const COMPONENT_STORAGEFILE_SUBPATH = 'src/lib/model/storagefile';
export const API_STORAGEFILE_SUBPATH = 'src/app/common/model/storagefile';
export const HANDLERS_SUBFOLDER_NAME = 'handlers';
export const INDEX_FILE = 'index.ts';
