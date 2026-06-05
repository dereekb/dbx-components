/**
 * Shared inspection types used by the two-side validate-app tools
 * (`dbx_storagefile_m_validate_app`, `dbx_notification_m_validate_app`).
 *
 * Each domain prepares an `AppXxxInspection` with one `SideInspection`
 * per directory (component + api) before extraction and rules run.
 * The {@link SideStatus} short-circuits content rules in the I/O block
 * shared by {@link import('./io-violations.js').pushIoViolations}.
 */

/**
 * I/O outcome for a single side's directory walk.
 *
 * - `'ok'` — root directory exists and at least one configured subpath was present.
 * - `'dir-not-found'` — root directory does not exist (or is not a directory).
 * - `'folder-missing'` — root exists but none of the configured subpaths were present.
 */
export type SideStatus = 'ok' | 'dir-not-found' | 'folder-missing';

/**
 * One non-spec `.ts` source file collected by the inspection.
 */
export interface InspectedFile {
  /**
   * Path relative to the side's root (e.g. `src/lib/model/storagefile/storagefile.ts`).
   */
  readonly relPath: string;
  readonly text: string;
}

/**
 * Inspection result for a single side (component or api).
 */
export interface SideInspection {
  readonly rootDir: string;
  /**
   * Comma-joined list of subpaths that were present under {@link rootDir},
   * or `undefined` when the directory was missing or none of the
   * configured subpaths were present.
   */
  readonly folder: string | undefined;
  readonly status: SideStatus;
  readonly files: readonly InspectedFile[];
}

/**
 * Two-side inspection input shared by the validate-app extractors.
 */
export interface TwoSideInspectionInput {
  readonly component: SideInspection;
  readonly api: SideInspection;
}
