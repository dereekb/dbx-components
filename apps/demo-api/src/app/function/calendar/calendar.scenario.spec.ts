import { describe, expect, it } from 'vitest';
import { expectFail, itShouldFail } from '@dereekb/util/test';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { describeCallableRequestTest, expectFailAssertHttpErrorServerErrorCode } from '@dereekb/firebase-server/test';
import { unfoldIcsString } from '@dereekb/date';
import { TEXT_CALENDAR_UTF8_CONTENT_TYPE } from '@dereekb/util';
import { CALENDAR_ICS_PUBLISHED_CACHE_CONTROL, CALENDAR_ICS_PUBLISHED_CONTENT_DISPOSITION } from '@dereekb/firebase-server/model';
import { CALENDAR_ICS_ROTATE_THROTTLED_ERROR_CODE, CALENDAR_ICS_STORAGE_FILE_PURPOSE, CalendarSyncState, FORBIDDEN_ERROR_CODE, MODEL_NOT_AVAILABLE_ERROR_CODE, type RotateCalendarIcsResult, StorageFileProcessingState, StorageFileState, calendarIdentity, calendarSyncState, firestoreModelKey, onCallUpdateModelParams } from '@dereekb/firebase';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoCalendarContext, demoProfileContext } from '../../../test/fixture';
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
  describeCallableRequestTest('calendar.scenario', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
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

            /**
             * The published feed has to name ITSELF, or a client that holds the file has no way back to the
             * source. `iu` and the ICS's SOURCE line are written from the same value in the same pass, so
             * this asserts they cannot drift.
             */
            it('should publish a public URL and emit it as the ICS SOURCE', async () => {
              await cal.createTestCalendarEvent('Sourced');
              await syncAndPublish();

              const published = await assertSnapshotData(cal.document);
              const icsUrl = published.iu as string;
              expect(icsUrl).toBeDefined();

              // keyed by the ICS StorageFile's own id, which is what makes replacing the file rotate the url
              expect(icsUrl).toContain(published.isf as string);

              const storageFile = await assertSnapshotData(await cal.loadIcsStorageFileDocument());
              const ics = (await f.storageContext.file(storageFile).getBytes()).toString();

              // unfolded, because a url this long is always split across physical lines by the 75-octet fold
              const lines = unfoldIcsString(ics);
              expect(lines).toContain(`SOURCE;VALUE=URI:${icsUrl}`);
              // a METHOD would turn the feed into an iTIP message, which Google refuses to subscribe to
              expect(ics).not.toContain('METHOD:');

              // the headers a subscriber's fetcher actually depends on. text/plain is rejected outright, an
              // "attachment" disposition breaks an inline feed fetch, and the default public max-age of one
              // hour would serve a regenerated feed stale on top of the client's own polling lag.
              const metadata = await f.storageContext.file(storageFile).getMetadata();
              expect(metadata.contentType).toBe(TEXT_CALENDAR_UTF8_CONTENT_TYPE);
              expect(metadata.contentDisposition).toBe(CALENDAR_ICS_PUBLISHED_CONTENT_DISPOSITION);
              expect(metadata.cacheControl).toBe(CALENDAR_ICS_PUBLISHED_CACHE_CONTROL);
            });

            // The exact inverse of the re-publish case above: there, isf must be PRESERVED; here it must change.
            it('should mint a new ICS StorageFile and URL when the link is rotated', async () => {
              await cal.createTestCalendarEvent('Rotate Me');
              await syncAndPublish();

              const published = await assertSnapshotData(cal.document);
              const oldIcsStorageFileDocument = await cal.loadIcsStorageFileDocument();
              const oldIcsStorageFile = await assertSnapshotData(oldIcsStorageFileDocument);

              expect(published.isf).toBeDefined();
              expect(published.iu).toBeDefined();

              const rotateResult = await cal.rotateCalendarIcs();
              expect(rotateResult.revokedIcsStorageFile).toBe(true);
              expect(rotateResult.createdIcsStorageFile).toBe(true);

              const rotated = await assertSnapshotData(cal.document);

              expect(rotated.isf).toBeDefined();
              expect(rotated.isf).not.toBe(published.isf);

              // the url is only written by the processor's success path, so it is absent until the
              // replacement actually uploads -- the state the dialog has to render rather than blank out
              expect(rotated.iu).toBeFalsy();

              const newIcsStorageFile = await assertSnapshotData(await cal.loadIcsStorageFileDocument());
              expect(newIcsStorageFile.pathString).not.toBe(oldIcsStorageFile.pathString);

              // the OLD file is what actually holds the revoked url. It is flagged for delete rather than
              // deleted inline, so its object survives until the delete sweep runs.
              const revokedIcsStorageFile = await assertSnapshotData(oldIcsStorageFileDocument);
              expect(revokedIcsStorageFile.fs).toBe(StorageFileState.QUEUED_FOR_DELETE);
              expect(revokedIcsStorageFile.sdat).toBeDefined();
              expect(await f.storageContext.file(revokedIcsStorageFile).exists()).toBe(true);
            });

            it('should publish a fresh URL after a rotation', async () => {
              await cal.createTestCalendarEvent('Rotate Then Publish');
              await syncAndPublish();

              const published = await assertSnapshotData(cal.document);

              await cal.rotateCalendarIcs();
              await syncAndPublish();

              const republished = await assertSnapshotData(cal.document);

              expect(calendarSyncState(republished)).toBe(CalendarSyncState.SYNCED);
              expect(republished.iu).toBeDefined();
              expect(republished.iu).not.toBe(published.iu);

              const storageFile = await assertSnapshotData(await cal.loadIcsStorageFileDocument());
              const ics = (await f.storageContext.file(storageFile).getBytes()).toString();

              expect(unfoldIcsString(ics)).toContain(`SOURCE;VALUE=URI:${republished.iu as string}`);
              expect(ics).toContain('Rotate Then Publish');
            });

            /**
             * Recurring events had no end-to-end coverage at all: every publish test above adds one-off
             * events, which take the `e` array and a discrete VEVENT. A recurring event takes `r` and the
             * RRULE branch of `calendarToICalendar()` instead, so nothing here reached that branch.
             */
            it('should publish a recurring event as an RRULE', async () => {
              await cal.createTestRecurringCalendarEvent('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=8', 'Recurring Me');

              await runScheduledTick();

              const calendar = await assertSnapshotData(cal.document);
              expect(calendar.sat).toBeDefined();
              expect(calendarSyncState(calendar)).toBe(CalendarSyncState.SYNCED);

              const storageFile = await assertSnapshotData(await cal.loadIcsStorageFileDocument());
              expect(storageFile.ps).toBe(StorageFileProcessingState.SUCCESS);

              const ics = (await f.storageContext.file(storageFile).getBytes()).toString();

              expect(ics).toContain('Recurring Me');
              // the rule has to reach the file as ONE prefix, not the "RRULE:RRULE:" doubling the stored
              // form invites, which every client silently drops
              expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=8');
              expect(ics).not.toContain('RRULE:RRULE:');
            });

            // The dev-project sequence that left a calendar stuck in PROCESSING: publish once, THEN add a
            // recurring event. The one-off version of this passes, so the recurring item is the variable.
            it('should re-publish when a recurring event is added after a successful publish', async () => {
              await cal.createTestCalendarEvent('One Off');
              await runScheduledTick();

              const published = await assertSnapshotData(cal.document);
              const firstSyncedAt = published.sat as Date;
              expect(firstSyncedAt).toBeDefined();

              await cal.createTestRecurringCalendarEvent('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=8', 'Added Recurring');

              await runScheduledTick();

              const storageFile = await assertSnapshotData(await cal.loadIcsStorageFileDocument());
              expect(storageFile.ps).toBe(StorageFileProcessingState.SUCCESS);

              const republished = await assertSnapshotData(cal.document);
              expect(calendarSyncState(republished)).toBe(CalendarSyncState.SYNCED);
              expect((republished.sat as Date).getTime()).toBeGreaterThan(firstSyncedAt.getTime());

              const ics = (await f.storageContext.file(storageFile).getBytes()).toString();

              expect(ics).toContain('One Off');
              expect(ics).toContain('Added Recurring');
            });

            /**
             * The stored `rr` is RRuleLines — a newline-joined blob that may carry RDATE/EXDATE lines
             * alongside the RRULE, not just the rule itself. Those lines are what populate the recurrence's
             * additionalDates/exceptionDates, and emitting them is the ONE path in iCalendarEventToComponent()
             * that reaches iCalendarDateTimeContentLine() through a forEach.
             *
             * That is the path the stuck dev calendar died on, so it gets a publish test of its own.
             */
            it('should publish a recurring event whose rule carries RDATE and EXDATE lines', async () => {
              await cal.createTestRecurringCalendarEvent('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=8\nRDATE:20260810T140000Z\nEXDATE:20260812T140000Z', 'Dated Recurring');

              await runScheduledTick();

              const storageFile = await assertSnapshotData(await cal.loadIcsStorageFileDocument());
              expect(storageFile.ps).toBe(StorageFileProcessingState.SUCCESS);

              const calendar = await assertSnapshotData(cal.document);
              expect(calendarSyncState(calendar)).toBe(CalendarSyncState.SYNCED);

              const ics = (await f.storageContext.file(storageFile).getBytes()).toString();

              expect(ics).toContain('Dated Recurring');
              expect(ics).toContain('RDATE:20260810T140000Z');
              expect(ics).toContain('EXDATE:20260812T140000Z');
            });
          });
        });
      });
    });

    /**
     * The rotate CALLABLE, as opposed to the server action the publish cases above drive directly.
     *
     * The action itself enforces nothing, so these are the only tests of the authorization: rotation is
     * gated on the Calendar's own `rotate` role, which the model service grants off `Calendar.o`.
     */
    describe('calendar.update.rotateIcs', () => {
      demoAuthorizedUserContext({ f }, (u) => {
        demoProfileContext({ f, u }, (p) => {
          demoCalendarContext({ f, profile: p, createTestCalendarEvent: 'Owner Rotate' }, (cal) => {
            it('should let the calendar owner rotate the link', async () => {
              const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(calendarIdentity, { key: cal.documentKey }, 'rotateIcs'))) as RotateCalendarIcsResult;

              // nothing was ever published, so there is no url to revoke -- but the rotation still queues
              // the first publish, which is what mints the replacement StorageFile
              expect(result.revokedIcsStorageFile).toBe(false);
              expect(result.createdIcsStorageFile).toBe(true);

              const rotated = await assertSnapshotData(cal.document);
              expect(rotated.isf).toBeDefined();
            });

            itShouldFail('with CALENDAR_ICS_ROTATE_THROTTLED when rotated twice inside the throttle window', async () => {
              // the first rotation stamps `rat`, which is the only input to the window -- so the second is
              // rejected by the action itself rather than by the UI that normally disables the button
              await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(calendarIdentity, { key: cal.documentKey }, 'rotateIcs'));

              await expectFail(() => u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(calendarIdentity, { key: cal.documentKey }, 'rotateIcs')), expectFailAssertHttpErrorServerErrorCode(CALENDAR_ICS_ROTATE_THROTTLED_ERROR_CODE));
            });

            demoAuthorizedUserContext({ f }, (u2) => {
              itShouldFail('with FORBIDDEN for a user who does not own the calendar', async () => {
                // the ownership key is the whole authorization: another signed-in user gets an empty role map
                await expectFail(() => u2.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(calendarIdentity, { key: cal.documentKey }, 'rotateIcs')), expectFailAssertHttpErrorServerErrorCode(FORBIDDEN_ERROR_CODE));
              });
            });
          });
        });
      });

      demoAuthorizedUserAdminContext({ f }, (au) => {
        itShouldFail('with MODEL_NOT_AVAILABLE for a calendar that does not exist', async () => {
          // deliberate: the profile-scoped predecessor no-oped here, which reported a revocation that
          // never happened. There is nothing to revoke and no owner to authorize against.
          await expectFail(() => au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(calendarIdentity, { key: firestoreModelKey(calendarIdentity, 'no-such-calendar') }, 'rotateIcs')), expectFailAssertHttpErrorServerErrorCode(MODEL_NOT_AVAILABLE_ERROR_CODE));
        });
      });
    });
  });
});
