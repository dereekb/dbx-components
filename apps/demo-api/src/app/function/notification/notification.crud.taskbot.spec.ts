import { demoCallModel } from '../model/crud.functions';
import { addHours } from 'date-fns';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoNotificationTaskBotContext, demoProfileContext } from '../../../test/fixture';
import { describeCallableRequestTest, expectFailAssertHttpErrorServerErrorCode } from '@dereekb/firebase-server/test';
import { assertSnapshotData, FIREBASE_SERVER_VALIDATION_ERROR_CODE } from '@dereekb/firebase-server';
import {
  FORBIDDEN_ERROR_CODE,
  getDocumentSnapshotData,
  NOTIFICATION_TASK_BOT_ENTRY_DOES_NOT_EXIST_ERROR_CODE,
  NOTIFICATION_TASK_BOT_ENTRY_NOT_RUNNABLE_ERROR_CODE,
  NOTIFICATION_TASK_BOT_PAUSE_REASON_MANUAL,
  notificationTaskBotEntry,
  NotificationTaskBotEntryState,
  notificationTaskBotIdentity,
  type NotificationTaskBotRunNotificationTaskData,
  NotificationTaskBotRunTrigger,
  onCallUpdateModelParams,
  type RunNotificationTaskBotEntryParams,
  type RunNotificationTaskBotEntryResult,
  type UpdateNotificationTaskBotEntryParams,
  type UpdateNotificationTaskBotEntryResult
} from '@dereekb/firebase';
import { DEMO_PING_NOTIFICATION_TASK_BOT_ENTRY_ID, DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE } from 'demo-firebase';
import { expectFail, itShouldFail } from '@dereekb/util/test';
import { type Maybe, MS_IN_HOUR } from '@dereekb/util';

const entryId = DEMO_PING_NOTIFICATION_TASK_BOT_ENTRY_ID;
const pingEntries = [{ entryId, scriptType: DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE, data: { iv: MS_IN_HOUR } }];

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('notification.crud.taskbot', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    describe('NotificationTaskBot', () => {
      demoAuthorizedUserAdminContext({ f }, (u) => {
        demoProfileContext({ f, u }, (p) => {
          demoNotificationTaskBotContext({ f, for: p, entries: pingEntries }, (ntb) => {
            const loadTask = (key: string) => getDocumentSnapshotData(f.demoFirestoreCollections.notificationCollectionGroup.documentAccessor().loadDocumentForKey(key));

            function callUpdate(params: Omit<UpdateNotificationTaskBotEntryParams, 'key' | 'i'> & Partial<Pick<UpdateNotificationTaskBotEntryParams, 'i'>>): Promise<UpdateNotificationTaskBotEntryResult> {
              return u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(notificationTaskBotIdentity, { key: ntb.documentKey, i: entryId, ...params }, 'entry')) as Promise<UpdateNotificationTaskBotEntryResult>;
            }

            function callRun(params: Omit<RunNotificationTaskBotEntryParams, 'key' | 'i'> & Partial<Pick<RunNotificationTaskBotEntryParams, 'i'>>): Promise<RunNotificationTaskBotEntryResult> {
              return u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(notificationTaskBotIdentity, { key: ntb.documentKey, i: entryId, ...params }, 'run')) as Promise<RunNotificationTaskBotEntryResult>;
            }

            async function loadEntry() {
              const bot = await assertSnapshotData(ntb.document);
              return notificationTaskBotEntry(bot, entryId)!;
            }

            describe('update/entry', () => {
              it('should pause the entry and delete its pending run', async () => {
                const before = await loadEntry();
                expect(before.nk).toBeDefined();

                const result = await callUpdate({ pause: true });
                const entry = await loadEntry();

                expect(result.taskKey).toBeFalsy();
                expect(entry.pat).toBeDefined();
                expect(entry.pr).toBe(NOTIFICATION_TASK_BOT_PAUSE_REASON_MANUAL);
                expect(entry.rn).toBeFalsy();
                expect(await loadTask(before.nk as string)).toBeUndefined();
              });

              it('should resume a paused entry and schedule a new run', async () => {
                await callUpdate({ pause: true });
                const result = await callUpdate({ pause: false });
                const entry = await loadEntry();

                expect(entry.pat).toBeFalsy();
                expect(result.taskKey).toBe(entry.nk);
                expect(await loadTask(result.taskKey as string)).toBeDefined();
              });

              it('should disable the entry', async () => {
                await callUpdate({ s: NotificationTaskBotEntryState.DISABLED });
                const entry = await loadEntry();

                expect(entry.s).toBe(NotificationTaskBotEntryState.DISABLED);
                expect(entry.rn).toBeFalsy();
              });

              it('should reschedule the entry at an explicit time', async () => {
                const nextRunAt = addHours(new Date(), 5);
                const result = await callUpdate({ nextRunAt });
                const entry = await loadEntry();
                const task = await loadTask(result.taskKey as string);

                expect(entry.nat?.getTime()).toBe(nextRunAt.getTime());
                expect(task?.sat.getTime()).toBe(nextRunAt.getTime());
                expect((task?.n.d as Maybe<NotificationTaskBotRunNotificationTaskData>)?.x).toBe(true);
              });

              it('should set and clear the last submitted at time', async () => {
                const lsat = addHours(new Date(), -1);
                await callUpdate({ lsat });
                expect((await loadEntry()).lsat?.getTime()).toBe(lsat.getTime());

                await callUpdate({ lsat: null });
                expect((await loadEntry()).lsat).toBeFalsy();
              });

              itShouldFail('for an unknown entry', async () => {
                await expectFail(() => callUpdate({ i: 'unknown', pause: true }), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_TASK_BOT_ENTRY_DOES_NOT_EXIST_ERROR_CODE));
              });

              itShouldFail('with an invalid entry id', async () => {
                await expectFail(() => callUpdate({ i: 'Not_Valid', pause: true }), expectFailAssertHttpErrorServerErrorCode(FIREBASE_SERVER_VALIDATION_ERROR_CODE));
              });
            });

            describe('update/run', () => {
              it('should supersede the pending run with a MANUAL run', async () => {
                const before = await loadEntry();
                const result = await callRun({ runImmediately: false });
                const entry = await loadEntry();
                const task = await loadTask(result.taskKey);

                expect(result.taskKey).toBe(entry.nk);
                expect(entry.rn).toBeGreaterThan(before.rn as number);
                expect((task?.n.d as Maybe<NotificationTaskBotRunNotificationTaskData>)?.tr).toBe(NotificationTaskBotRunTrigger.MANUAL);
                expect(await loadTask(before.nk as string)).toBeUndefined();
              });

              it('should create and run a FORCED run', async () => {
                const result = await callRun({ trigger: NotificationTaskBotRunTrigger.FORCED });
                const entry = await loadEntry();

                expect(result.taskKey).toBeDefined();
                expect(result.runResult?.success).toBe(true);
                expect(entry.sc).toBe(1);
                expect(entry.h[entry.h.length - 1].tr).toBe(NotificationTaskBotRunTrigger.FORCED);
              });

              itShouldFail('for a paused entry', async () => {
                await callUpdate({ pause: true });
                await expectFail(() => callRun({}), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_TASK_BOT_ENTRY_NOT_RUNNABLE_ERROR_CODE));
              });

              itShouldFail('for a disabled entry', async () => {
                await callUpdate({ s: NotificationTaskBotEntryState.DISABLED });
                await expectFail(() => callRun({}), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_TASK_BOT_ENTRY_NOT_RUNNABLE_ERROR_CODE));
              });

              itShouldFail('for an unknown entry', async () => {
                await expectFail(() => callRun({ i: 'unknown' }), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_TASK_BOT_ENTRY_DOES_NOT_EXIST_ERROR_CODE));
              });
            });
          });
        });
      });

      demoAuthorizedUserContext({ f }, (u) => {
        demoProfileContext({ f, u }, (p) => {
          demoNotificationTaskBotContext({ f, for: p, entries: pingEntries }, (ntb) => {
            itShouldFail('with FORBIDDEN for a non-admin', async () => {
              await expectFail(() => u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(notificationTaskBotIdentity, { key: ntb.documentKey, i: entryId, pause: true }, 'entry')), expectFailAssertHttpErrorServerErrorCode(FORBIDDEN_ERROR_CODE));
              await expectFail(() => u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(notificationTaskBotIdentity, { key: ntb.documentKey, i: entryId }, 'run')), expectFailAssertHttpErrorServerErrorCode(FORBIDDEN_ERROR_CODE));
            });
          });
        });
      });
    });
  });
});
