import { type Maybe, type SlashPath, type SlashPathFile, type SlashPathFolder, mergeSlashPaths } from '@dereekb/util';
import { type StorageFileMetadata, type StorageFilePurpose } from '../storagefile/storagefile.id';
import { type StorageFileProcessingSubtask, type StorageFileProcessingSubtaskMetadata } from '../storagefile/storagefile.task';
import { type CalendarId } from './calendar.id';

/**
 * @module calendar.processing
 *
 * The StorageFile purpose that publishes a Calendar's ".ics", mirroring `storagefile.group.processing.ts`.
 *
 * DIVERGENCE FROM THE ZIP FLOW, stated explicitly: a StorageFileGroup's zip StorageFile uses
 * {@link StorageFileCreationType.FOR_STORAGE_FILE_GROUP}, which derives a DETERMINISTIC document id from its
 * parent group. A Calendar is not a StorageFileGroup, so its ICS StorageFile is `DIRECTLY_CREATED` and its id
 * is carried on `Calendar.isf`. That is the `zsf` half of the pattern without the deterministic-key half.
 */

/**
 * {@link StorageFilePurpose} identifier for a Calendar's published ICS file.
 */
export const CALENDAR_ICS_STORAGE_FILE_PURPOSE: StorageFilePurpose = 'cal_ics';

/**
 * Subtask checkpoint identifier for the ICS generation step of Calendar processing.
 */
export const CALENDAR_ICS_STORAGE_FILE_PURPOSE_GENERATE_ICS_SUBTASK: StorageFileProcessingSubtask = 'generate_ics';

/**
 * Type alias for the ICS generation subtask checkpoint string.
 */
export type CalendarIcsStorageFileProcessingSubtask = typeof CALENDAR_ICS_STORAGE_FILE_PURPOSE_GENERATE_ICS_SUBTASK;

/**
 * Metadata type for the ICS generation subtask.
 */
export type CalendarIcsStorageFileProcessingSubtaskMetadata = StorageFileProcessingSubtaskMetadata;

/**
 * Metadata stored on the ICS StorageFile, linking it back to the Calendar it publishes.
 *
 * This is the ONLY link the processor has: the StorageFile is directly created, so its id carries no
 * information about its calendar.
 */
export interface CalendarIcsStorageFileMetadata extends StorageFileMetadata {
  /**
   * Calendar id. Id of the Calendar this ICS file was generated for.
   */
  readonly cal: CalendarId;
}

/**
 * Root folder in Firebase Storage where all Calendar-generated files are stored.
 *
 * Each calendar gets a subfolder: `/cal/{calendarId}/`.
 */
export const CALENDAR_ROOT_FOLDER_PATH: SlashPathFolder = '/cal/';

/**
 * Builds the storage folder path for a specific Calendar, optionally with sub-paths.
 *
 * @param calendarId - The calendar's document id.
 * @param subPath - Optional sub-paths to append.
 * @returns The folder path.
 *
 * @example
 * ```ts
 * const folder = calendarFolderPath('pr_abc123'); // '/cal/pr_abc123/'
 * ```
 */
export function calendarFolderPath(calendarId: CalendarId, ...subPath: Maybe<SlashPath>[]): SlashPathFolder {
  return mergeSlashPaths([CALENDAR_ROOT_FOLDER_PATH, calendarId, '/', ...subPath]) as SlashPathFolder;
}

/**
 * File name of a Calendar's published ICS within its folder.
 */
export const CALENDAR_ICS_FILE_PATH: SlashPathFile = 'c.ics';

/**
 * Returns the full storage path for a Calendar's published ICS file.
 *
 * @param calendarId - The calendar's document id.
 * @returns The full path to the calendar's ICS file.
 *
 * @example
 * ```ts
 * const icsPath = calendarIcsFileStoragePath('pr_abc123'); // '/cal/pr_abc123/c.ics'
 * ```
 */
export function calendarIcsFileStoragePath(calendarId: CalendarId): SlashPath {
  return calendarFolderPath(calendarId, CALENDAR_ICS_FILE_PATH);
}
