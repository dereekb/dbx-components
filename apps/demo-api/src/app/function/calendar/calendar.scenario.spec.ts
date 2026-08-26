import { describe, expect, it } from 'vitest';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { CALENDAR_ICS_STORAGE_FILE_PURPOSE, CalendarSyncState, StorageFileProcessingState, calendarSyncState } from '@dereekb/firebase';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoCalendarContext, demoProfileContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';
import { notificationHourlyUpdateSchedule } from '../notification/notification.schedule';
import { storageFileHourlyUpdateSchedule } from '../storagefile/storagefile.schedule';
import { calendarHourlyUpdateSchedule } from './calendar.schedule';

/**
 * End-to-end coverage of the Calendar publish pipeline, which had none: every piece of it was unit tested
 * in isolation, so nothing caught the fact that the pieces never actually reached each other in the app.
 *
 * The chain under test is exactly what `calendarHourlyUpdateSchedule` drives:
 *
 *   createTestCalendarEvent (s: true)
 *     -> syncAllFlaggedCalendars  (clears s, creates/re-flags the ICS StorageFile)
 *       -> the SFP notification task  (renders + uploads the ICS, writes sat)
 */
demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('calendar.scenario', { f, fns: { demoCallModel } }, () => {
    demoAuthorizedUserAdminContext({ f }, (au) => {
      demoProfileContext({ f, u: au }, (p) => {
        demoCalendarContext({ f, profile: p }, (cal) => {
          /**
           * One pass of `storageFileHourlyUpdateSchedule`'s processing step.
           *
           * Required for a FIRST publish: `syncCalendar()` creates the ICS StorageFile already flagged
           * `shouldBeProcessed`, but only drives `processStorageFile` itself on the re-flag path — a newly
           * created file waits here instead. The real tick covers it by running the storagefile schedule
           * straight after the calendar one.
           */
          async function processAllQueuedStorageFiles() {
            const processAllQueuedStorageFiles = await f.storageFileServerActions.processAllQueuedStorageFiles({});
            return processAllQueuedStorageFiles();
          }

          /**
           * One pass of the notification queue, which is what actually runs the ICS subtask.
           */
          async function runNotificationTasks() {
            const sendQueuedNotifications = await f.notificationServerActions.sendQueuedNotifications({});
            return sendQueuedNotifications();
          }

          /**
           * Clears the throttle a notification pass leaves behind, so a following pass runs the task again
           * rather than skipping it. Mirrors the resume scenario's helper.
           */
          async function clearProcessingTaskThrottle() {
            const storageFile = await assertSnapshotData(await cal.loadIcsStorageFileDocument());

            if (storageFile.pn) {
              await f.demoFirestoreCollections.notificationCollectionGroup.documentAccessor().loadDocumentForKey(storageFile.pn).update({ sat: new Date() });
            }
          }

          /**
           * ONE run of `demoExampleUsageOfSchedule`'s calendar-relevant chain, in its real order.
           *
           * No throttle winding and no hand-called server actions — exactly what a user gets from clicking
           * `run` on the dev-tools scheduled-function widget.
           */
          async function runScheduledTick() {
            const request = { nest: f.instance.apiNestContext } as Parameters<typeof calendarHourlyUpdateSchedule>[0];

            await calendarHourlyUpdateSchedule(request);
            await storageFileHourlyUpdateSchedule(request);
            await notificationHourlyUpdateSchedule(request);
          }

          /**
           * Drives the calendar all the way to a published ICS, the way one scheduled tick does.
           */
          async function syncAndPublish() {
            await cal.syncAllFlaggedCalendars();
            await processAllQueuedStorageFiles();
            await runNotificationTasks();
            await clearProcessingTaskThrottle();
            await runNotificationTasks();
          }

          describe('publishing a profile calendar', () => {
            it('should flag a newly created calendar for sync', async () => {
              await cal.createTestCalendarEvent();

              const calendar = await assertSnapshotData(cal.document);

              expect(calendar.s).toBe(true);
              expect(calendar.sat).toBeFalsy();
              expect(calendarSyncState(calendar)).toBe(CalendarSyncState.QUEUED);
            });

            it('should clear the sync flag and create the ICS StorageFile', async () => {
              await cal.createTestCalendarEvent();

              const result = await cal.syncAllFlaggedCalendars();
              expect(result.calendarsSyncedCount).toBe(1);
              expect(result.calendarsFailedCount).toBe(0);

              const calendar = await assertSnapshotData(cal.document);
              expect(calendar.s).toBeFalsy();
              expect(calendar.isf).toBeDefined();

              const storageFile = await assertSnapshotData(await cal.loadIcsStorageFileDocument());
              expect(storageFile.p).toBe(CALENDAR_ICS_STORAGE_FILE_PURPOSE);
            });

            it('should render and upload the ICS, and record the publish on the calendar', async () => {
              await cal.createTestCalendarEvent('Publish Me');
              await syncAndPublish();

              const calendar = await assertSnapshotData(cal.document);

              // sat is written ONLY by the processor's success path, so its presence IS the proof the ICS
              // actually landed rather than merely being queued.
              expect(calendar.sat).toBeDefined();
              expect(calendarSyncState(calendar)).toBe(CalendarSyncState.SYNCED);

              const storageFile = await assertSnapshotData(await cal.loadIcsStorageFileDocument());
              expect(storageFile.ps).toBe(StorageFileProcessingState.SUCCESS);

              const icsFile = f.storageContext.file(storageFile);
              expect(await icsFile.exists()).toBe(true);

              const ics = (await icsFile.getBytes()).toString();
              expect(ics).toContain('BEGIN:VCALENDAR');
              expect(ics).toContain('Publish Me');
              expect(ics).toContain('END:VCALENDAR');
            });

            /**
             * The chain the dev-tools widget actually runs, in the order `demoExampleUsageOfSchedule`
             * chains it — rather than the server actions called by hand above.
             *
             * This is what tells a real "the demo cannot sync" apart from "the harness drove it wrong":
             * ONE tick, no throttle winding, exactly what a user clicking `run` gets.
             */
            it('should publish the ICS within a single scheduled tick', async () => {
              await cal.createTestCalendarEvent('Scheduled');

              await runScheduledTick();

              const calendar = await assertSnapshotData(cal.document);
              expect(calendar.sat).toBeDefined();
              expect(calendarSyncState(calendar)).toBe(CalendarSyncState.SYNCED);
            });

            // The regression the demo page surfaced: a calendar that had published once, then changed.
            it('should re-publish and advance sat when an event is added after a successful publish', async () => {
              await cal.createTestCalendarEvent('First');
              await runScheduledTick();

              const published = await assertSnapshotData(cal.document);
              const firstSyncedAt = published.sat as Date;
              expect(firstSyncedAt).toBeDefined();

              await cal.createTestCalendarEvent('Second');

              const queued = await assertSnapshotData(cal.document);
              expect(queued.s).toBe(true);
              expect(calendarSyncState(queued)).toBe(CalendarSyncState.QUEUED);

              await runScheduledTick();

              const republished = await assertSnapshotData(cal.document);
              expect(calendarSyncState(republished)).toBe(CalendarSyncState.SYNCED);
              expect((republished.sat as Date).getTime()).toBeGreaterThan(firstSyncedAt.getTime());

              // The ICS the second sweep uploaded has to carry BOTH events, and it has to be the same
              // StorageFile: a re-publish re-flags the existing one rather than creating a duplicate.
              expect(republished.isf).toBe(published.isf);

              const storageFile = await assertSnapshotData(await cal.loadIcsStorageFileDocument());
              const ics = (await f.storageContext.file(storageFile).getBytes()).toString();

              expect(ics).toContain('First');
              expect(ics).toContain('Second');
            });
          });
        });
      });
    });
  });
});
