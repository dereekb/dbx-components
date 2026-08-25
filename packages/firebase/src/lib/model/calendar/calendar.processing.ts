import { type SlashPath, type SlashPathFolder, mergeSlashPaths } from '@dereekb/util';
import { type StorageFileId, type StorageFileMetadata, type StorageFilePurpose } from '../storagefile/storagefile.id';
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
 *
 * BECAUSE the id is non-deterministic, the ICS path is keyed by the STORAGE FILE's id, not the calendar's.
 * A calendar-keyed path would let two StorageFiles resolve to the same object: when the previous ICS
 * StorageFile is QUEUED_FOR_DELETE but not yet swept, the sync creates a replacement, and the sweep's
 * `storageService.file(oldStorageFile).delete()` would then delete the REPLACEMENT's content while its own
 * document still read SUCCESS — a hole `flagStaleCalendarsForSync()` cannot heal, since it compares `sat`
 * against `uat` and `sat` is newer. A StorageFile-keyed path makes that collision unrepresentable, and has
 * the side benefit that the published object is not guessable from the owner's uid.
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
 * Flat by design: a Calendar has exactly one derived artifact, so there is nothing for a per-calendar
 * subfolder to group. Contrast `storageFileGroupFolderPath()`, whose variadic sub-path earns its keep
 * because a group holds many derived files.
 */
export const CALENDAR_ROOT_FOLDER_PATH: SlashPathFolder = '/cal/';

/**
 * File extension of a Calendar's published ICS.
 */
export const CALENDAR_ICS_FILE_EXTENSION = '.ics';

/**
 * Returns the storage path for a Calendar's published ICS file.
 *
 * Keyed by the ICS StorageFile's OWN id rather than the calendar's, so two StorageFiles can never resolve
 * to the same object — see this module's header for the deletion collision that would otherwise exist.
 *
 * @param storageFileId - The id of the StorageFile that holds the published ICS.
 * @returns The full path to the calendar's ICS file.
 *
 * @example
 * ```ts
 * const icsPath = calendarIcsFileStoragePath('0mfR2xk8SqVe1Nb7'); // '/cal/0mfR2xk8SqVe1Nb7.ics'
 * ```
 */
export function calendarIcsFileStoragePath(storageFileId: StorageFileId): SlashPath {
  return mergeSlashPaths([CALENDAR_ROOT_FOLDER_PATH, `${storageFileId}${CALENDAR_ICS_FILE_EXTENSION}`]);
}
