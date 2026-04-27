/**
 * Public entry points for the storagefile-folder validator. Wires the
 * shared two-side folder engine with this domain's labels, paths, and
 * `'STORAGEFILE_FOLDER_*'` literal codes; exposes the original public
 * API (`validateStorageFileFolder`, `inspectStorageFileFolder`,
 * `formatResult`) so tool wrappers and specs stay unchanged.
 */

import { createTwoSideFolderValidator } from '../validate-two-side-folder.js';
import { API_STORAGEFILE_SUBPATH, CANONICAL_API_ROOT_FILES, COMPONENT_STORAGEFILE_SUBPATH, HANDLERS_SUBFOLDER_NAME, INDEX_FILE, REQUIRED_API_FILES, STORAGEFILE_FILE_PREFIX, type ViolationCode } from './types.js';

const storageFileFolderValidator = createTwoSideFolderValidator<ViolationCode>({
  fileLabel: 'Storagefile',
  lowerLabel: 'storagefile',
  filePrefix: STORAGEFILE_FILE_PREFIX,
  componentSubPath: COMPONENT_STORAGEFILE_SUBPATH,
  apiSubPath: API_STORAGEFILE_SUBPATH,
  handlersSubfolderName: HANDLERS_SUBFOLDER_NAME,
  indexFile: INDEX_FILE,
  requiredApiFiles: REQUIRED_API_FILES,
  canonicalApiRootFiles: CANONICAL_API_ROOT_FILES,
  codes: {
    componentDirNotFound: 'STORAGEFILE_FOLDER_COMPONENT_DIR_NOT_FOUND',
    apiDirNotFound: 'STORAGEFILE_FOLDER_API_DIR_NOT_FOUND',
    componentFolderMissing: 'STORAGEFILE_FOLDER_COMPONENT_FOLDER_MISSING',
    apiFolderMissing: 'STORAGEFILE_FOLDER_API_FOLDER_MISSING',
    barrelReexportMissing: 'STORAGEFILE_FOLDER_BARREL_REEXPORT_MISSING',
    unexpectedFileName: 'STORAGEFILE_FOLDER_UNEXPECTED_FILE_NAME',
    handlersSubfolderMixed: 'STORAGEFILE_FOLDER_HANDLERS_SUBFOLDER_MIXED'
  }
});

export const inspectStorageFileFolder = storageFileFolderValidator.inspect;
export const validateStorageFileFolder = storageFileFolderValidator.validate;

export { formatResult } from './format.js';
export type { SideInspection, StorageFileFolderInspection, ValidationResult, Violation, ViolationCode, ViolationSeverity } from './types.js';
