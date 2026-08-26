import {
  type AppCalendarTypeConfigService,
  type CalendarFirestoreCollections,
  type CalendarIcsStorageFileMetadata,
  type CalendarIcsStorageFileProcessingSubtask,
  type CalendarIcsStorageFileProcessingSubtaskMetadata,
  CALENDAR_ICS_STORAGE_FILE_PURPOSE,
  CALENDAR_ICS_STORAGE_FILE_PURPOSE_GENERATE_ICS_SUBTASK,
  calendarToIcsString,
  calendarTypeConfigIcsConfig,
  calendarTypeConfigIcsExpansionRange,
  type FirebaseStorageAccessor,
  notificationSubtaskComplete,
  notificationTaskComplete
} from '@dereekb/firebase';
import { type Maybe, TEXT_CALENDAR_UTF8_CONTENT_TYPE } from '@dereekb/util';
import { type NotificationTaskSubtaskResult } from '../notification/notification.task.subtask.handler';
import { type StorageFileProcessingPurposeSubtaskProcessorConfigWithTarget } from '../storagefile/storagefile.task.service.handler';
import { markStorageFileForDeleteTemplate } from '../storagefile/storagefile.util';

/**
 * Configuration for {@link calendarIcsStorageFileProcessingPurposeSubtaskProcessor}.
 */
export interface CalendarIcsStorageFileProcessingPurposeSubtaskProcessorConfig {
  readonly calendarFirestoreCollections: CalendarFirestoreCollections;
  readonly storageAccessor: FirebaseStorageAccessor;
  readonly appCalendarTypeConfigService: AppCalendarTypeConfigService;
  /**
   * The domain every generated event UID is suffixed with.
   */
  readonly icsDomain: string;
}

/**
 * Creates the ICS subtask processor for Calendar publishing.
 *
 * Far shorter than the StorageFileGroup zip processor, and deliberately so: there is no stream branch,
 * because `FirebaseStorageAccessorFile.upload()` is non-optional while `uploadStream?` is not, and an ICS for
 * a few hundred events is tens of kilobytes.
 *
 * It renders with `now: calendar.uat` rather than the wall clock, so DTSTAMP moves only when the content
 * moves — which is what makes the output byte-identical for identical input. The processor is idempotent: a
 * retry simply re-renders and re-uploads.
 *
 * The shared cleanup step then writes `ps: SUCCESS`, `pcat: now`, `pn: null`, which is exactly "the published
 * ICS is uploaded and current".
 *
 * @param config - The collections, storage accessor, type registry, and UID domain.
 * @returns A subtask processor config targeting the Calendar ICS purpose.
 */
export function calendarIcsStorageFileProcessingPurposeSubtaskProcessor(config: CalendarIcsStorageFileProcessingPurposeSubtaskProcessorConfig): StorageFileProcessingPurposeSubtaskProcessorConfigWithTarget<CalendarIcsStorageFileProcessingSubtaskMetadata, CalendarIcsStorageFileProcessingSubtask> {
  const { calendarFirestoreCollections, storageAccessor, appCalendarTypeConfigService, icsDomain } = config;
  const { calendarCollection } = calendarFirestoreCollections;

  return {
    target: CALENDAR_ICS_STORAGE_FILE_PURPOSE,
    flow: [
      {
        subtask: CALENDAR_ICS_STORAGE_FILE_PURPOSE_GENERATE_ICS_SUBTASK,
        fn: async (input) => {
          const { storageFileDocument, fileDetailsAccessor } = input;

          const storageFile = await input.loadStorageFile();
          const calendarId = (storageFile.d as Maybe<CalendarIcsStorageFileMetadata>)?.cal;

          let result: NotificationTaskSubtaskResult<CalendarIcsStorageFileProcessingSubtaskMetadata, CalendarIcsStorageFileProcessingSubtask>;

          async function flagStorageFileForDeletion() {
            await storageFileDocument.update(markStorageFileForDeleteTemplate());
            return notificationTaskComplete(); // skip the cleanup step
          }

          if (calendarId) {
            const calendarDocument = calendarCollection.documentAccessor().loadDocumentForId(calendarId);
            const calendar = await calendarDocument.snapshotData();

            if (calendar) {
              try {
                const typeConfig = appCalendarTypeConfigService.configForCalendarType(calendar.t);

                const ics = calendarToIcsString(calendar, {
                  ...calendarTypeConfigIcsConfig(typeConfig),
                  calendarId,
                  domain: icsDomain,
                  expansionRange: calendarTypeConfigIcsExpansionRange(typeConfig, new Date()),
                  // the CONTENT's instant, not the wall clock: DTSTAMP then moves only when the calendar moves
                  now: calendar.uat
                });

                await storageAccessor.file(fileDetailsAccessor.input).upload(Buffer.from(ics, 'utf8'), { contentType: TEXT_CALENDAR_UTF8_CONTENT_TYPE });

                // sat is set ONLY here, on the success path. That is what makes "s === false && sat < uat"
                // mean "queued, not yet published".
                //
                // isf is re-asserted alongside it so the calendar's pointer always names the StorageFile whose
                // bytes actually landed. syncCalendar() sets it optimistically when it creates the file (it has
                // to, so the next sweep can find and re-flag it rather than creating a duplicate); this write
                // is what makes it TRUE, and self-heals a pointer left behind by a run that died mid-flight.
                await calendarDocument.update({ isf: storageFileDocument.id, sat: new Date() });

                result = notificationSubtaskComplete({
                  canRunNextCheckpoint: true
                });
              } catch (e) {
                // The task-level catch records only "this task threw", which leaves a stuck calendar with no
                // way to tell a render failure from an upload failure. Name the calendar, the StorageFile and
                // the object path before rethrowing, so the retry loop is diagnosable from the logs alone.
                // The recurrence lines are dumped verbatim because they are the one part of a Calendar the
                // model read normalizes on the way out: a stray RDATE/EXDATE line inside `rr` is invisible in
                // a converted view of the document, and is exactly what turns into an unserializable date.
                const recurrences = JSON.stringify((calendar.r ?? []).map((x) => ({ id: x.id, rr: x.rr, rex: x.rex, rea: x.rea, rfe: x.rfe })));

                console.error(`calendarIcsStorageFileProcessingPurposeSubtaskProcessor(): failed publishing the ICS for calendar "${calendarId}" (type "${calendar.t}", ${calendar.e?.length ?? 0} events, ${calendar.r?.length ?? 0} recurring, recurrences=${recurrences}) to StorageFile "${storageFileDocument.id}" at "${fileDetailsAccessor.input.bucketId}${fileDetailsAccessor.input.pathString}": `, e);
                throw e;
              }
            } else {
              // the Calendar no longer exists. Flag the StorageFile for deletion.
              result = await flagStorageFileForDeletion();
            }
          } else {
            // improperly configured StorageFile for this purpose. Flag the StorageFile for deletion.
            result = await flagStorageFileForDeletion();
          }

          return result;
        }
      }
    ]
  };
}
