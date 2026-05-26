/**
 * Reserved model-folder names used by both scanners (skip these folders
 * during canonical extraction) and the `dbx_validate_model_folder` validator
 * (emit a warning naming the dedicated validator instead of running the
 * 5-file structural rules).
 *
 * Canonical home so the scan side does not need to reach back into the
 * dbx-components-mcp `tools/` tree.
 */

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
 * emits a `RESERVED_MODEL_FOLDER` warning naming the
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
