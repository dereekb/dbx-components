/**
 * Domain types and constants for the
 * `dbx_storagefile_m_validate_folder` validator.
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
 *
 * The structural types ({@link SideInspection},
 * {@link StorageFileFolderInspection}, {@link Violation},
 * {@link ValidationResult}) are aliases of the shared
 * `validate-two-side-folder` engine specialised on this domain's
 * {@link ViolationCode} literal union.
 */

import type { RequiredApiFile, SideInspection as SharedSideInspection, TwoSideFolderInspection, TwoSideFolderValidationResult, TwoSideFolderViolation } from '../validate-two-side-folder.js';
import type { StorageFileMValidateFolderCode } from './codes.js';

export type { SideStatus, ViolationSeverity } from '../validate-two-side-folder.js';

/**
 * String-literal union derived from {@link StorageFileMValidateFolderCode}.
 * Source of truth for code metadata is the enum's per-member JSDoc;
 * the template-literal type widens the enum back to its underlying
 * SCREAMING_SNAKE strings so existing emit-sites still typecheck.
 */
export type ViolationCode = `${StorageFileMValidateFolderCode}`;

export type SideInspection = SharedSideInspection;
export type StorageFileFolderInspection = TwoSideFolderInspection;
export type Violation = TwoSideFolderViolation<ViolationCode>;
export type ValidationResult = TwoSideFolderValidationResult<ViolationCode>;

export const REQUIRED_API_FILES: readonly RequiredApiFile<ViolationCode>[] = [
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
