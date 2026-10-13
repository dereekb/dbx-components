import { demoCallModel } from '../model/crud.functions';
import { addHours } from 'date-fns';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoNotificationTaskBotContext, demoProfileContext } from '../../../test/fixture';
import { describeCallableRequestTest, expectFailAssertHttpErrorServerErrorCode } from '@dereekb/firebase-server/test';
import { assertSnapshotData, FIREBASE_SERVER_VALIDATION_ERROR_CODE } from '@dereekb/firebase-server';
import {
  FORBIDDEN_ERROR_CODE,
  firestoreModelKey,
  getDocumentSnapshotData,
  MODEL_NOT_AVAILABLE_ERROR_CODE,
  NOTIFICATION_TASK_BOT_ENTRY_DATA_PATCH_INVALID_ERROR_CODE,
  NOTIFICATION_TASK_BOT_ENTRY_DATA_PATCH_NOT_ALLOWED_ERROR_CODE,
  NOTIFICATION_TASK_BOT_ENTRY_DOES_NOT_EXIST_ERROR_CODE,
  NOTIFICATION_TASK_BOT_ENTRY_NOT_RUNNABLE_ERROR_CODE,
  NOTIFICATION_TASK_BOT_ENTRY_OPTED_OUT_ERROR_CODE,
  NOTIFICATION_TASK_BOT_OPT_OUT_NOT_ALLOWED_ERROR_CODE,
  NOTIFICATION_TASK_BOT_OPT_OUT_REQUIRES_OWNER_ERROR_CODE,
  NOTIFICATION_TASK_BOT_PAUSE_REASON_FAILED,
  NOTIFICATION_TASK_BOT_PAUSE_REASON_MANUAL,
  NotificationTaskBotRunOutcome,
  type NotificationTaskBotEntryId,
  notificationTaskBotEntry,
  NotificationTaskBotEntryState,
  NotificationTaskBotEntryStatus,
  notificationTaskBotIdentity,
  notificationTaskBotKeyForModel,
  type NotificationTaskBotOptOutsResult,
  type NotificationTaskBotRunNotificationTaskData,
  NotificationTaskBotRunTrigger,
  onCallReadModelParams,
  onCallUpdateModelParams,
  type ReadNotificationTaskBotOptOutsParams,
  type UpdateNotificationTaskBotOptOutParams,
  type RunNotificationTaskBotEntryParams,
  type RunNotificationTaskBotEntryResult,
  type UpdateNotificationTaskBotEntryParams,
  type UpdateNotificationTaskBotEntryResult
} from '@dereekb/firebase';
import { DEMO_PING_NOTIFICATION_TASK_BOT_ENTRY_ID, DEMO_PING_NOTIFICATION_TASK_BOT_GROUP, DEMO_PING_NOTIFICATION_TASK_BOT_PAUSE_REASON_LIMIT, DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE, profileIdentity } from 'demo-firebase';
import { expectFail, itShouldFail } from '@dereekb/util/test';
import { type Maybe, MS_IN_HOUR } from '@dereekb/util';

const entryId = DEMO_PING_NOTIFICATION_TASK_BOT_ENTRY_ID;
const pingEntries = [{ entryId, scriptType: DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE, data: { iv: MS_IN_HOUR } }];

const requiredEntryId: NotificationTaskBotEntryId = 'ping-required';
const requiredPingEntry = { entryId: requiredEntryId, scriptType: DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE, data: { iv: MS_IN_HOUR } };
const ownedEntries = [...pingEntries, requiredPingEntry];

const unknownScriptEntryId: NotificationTaskBotEntryId = 'unknown';
const unknownScriptEntries = [{ entryId: unknownScriptEntryId, scriptType: 'demo_unknown', data: { a: 1 }, schedule: false as const }];
const pingGroupKey = DEMO_PING_NOTIFICATION_TASK_BOT_GROUP.key;

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

            // loses the live run, so the repair sweep (default lostRunPolicy 'stop') pauses the entry with 'failed'
            async function pauseWithFailed() {
              const entry = await loadEntry();
              await f.demoFirestoreCollections.notificationCollectionGroup
                .documentAccessor()
                .loadDocumentForKey(entry.nk as string)
                .accessor.delete();
              await f.notificationServerActions.repairAllNotificationTaskBots({ now: addHours(new Date(), 2) });
              expect((await loadEntry()).pr).toBe(NOTIFICATION_TASK_BOT_PAUSE_REASON_FAILED);
            }

            describe('update/entry', () => {
              it('should report stalled for an entry whose run is stalled', async () => {
                // nothing picks up the fresh run, so the repair sweep marks it stalled
                await f.notificationServerActions.repairAllNotificationTaskBots({ now: addHours(new Date(), 2) });

                const result = await callUpdate({ lsat: addHours(new Date(), -1) });
                expect(result.status).toBe(NotificationTaskBotEntryStatus.STALLED);
              });

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
                expect(entry.rpr).toBe(NOTIFICATION_TASK_BOT_PAUSE_REASON_MANUAL);
                expect(result.taskKey).toBe(entry.nk);
                expect(await loadTask(result.taskKey as string)).toBeDefined();
              });

              it('should pause the entry until a time', async () => {
                const pauseUntil = addHours(new Date(), 2);
                const result = await callUpdate({ pauseUntil });
                const entry = await loadEntry();
                const task = await loadTask(result.taskKey as string);

                expect(result.status).toBe(NotificationTaskBotEntryStatus.PAUSED);
                expect(entry.pr).toBe(NOTIFICATION_TASK_BOT_PAUSE_REASON_MANUAL);
                expect(entry.pu?.getTime()).toBe(pauseUntil.getTime());
                expect(result.taskKey).toBe(entry.nk);
                expect(task?.sat.getTime()).toBe(pauseUntil.getTime());
              });

              it('should resume a paused-until entry early', async () => {
                const paused = await callUpdate({ pauseUntil: addHours(new Date(), 2) });
                const result = await callUpdate({ pause: false });
                const entry = await loadEntry();
                const task = await loadTask(result.taskKey as string);

                expect(result.status).toBe(NotificationTaskBotEntryStatus.SCHEDULED);
                expect(entry.pat).toBeFalsy();
                expect(entry.pu).toBeFalsy();
                expect(entry.rpr).toBe(NOTIFICATION_TASK_BOT_PAUSE_REASON_MANUAL);
                expect(await loadTask(paused.taskKey as string)).toBeUndefined();
                expect(result.taskKey).not.toBe(paused.taskKey);
                expect(task?.sat.getTime()).toBeLessThanOrEqual(Date.now());
              });

              it('should disable the entry', async () => {
                await callUpdate({ s: NotificationTaskBotEntryState.DISABLED });
                const entry = await loadEntry();

                expect(entry.s).toBe(NotificationTaskBotEntryState.DISABLED);
                expect(entry.rn).toBeFalsy();
              });

              it('should schedule a not-before run at nextRunAt', async () => {
                const nextRunAt = addHours(new Date(), 5);
                const result = await callUpdate({ nextRunAt });
                const entry = await loadEntry();
                const task = await loadTask(result.taskKey as string);

                expect(entry.nat?.getTime()).toBe(nextRunAt.getTime());
                expect(task?.sat.getTime()).toBe(nextRunAt.getTime());
                expect((task?.n.d as Maybe<NotificationTaskBotRunNotificationTaskData>)?.x).toBeFalsy();
              });

              it('should reschedule the entry at an explicit time', async () => {
                const nextRunAtExplicit = addHours(new Date(), 5);
                const result = await callUpdate({ nextRunAtExplicit });
                const entry = await loadEntry();
                const task = await loadTask(result.taskKey as string);

                expect(entry.nat?.getTime()).toBe(nextRunAtExplicit.getTime());
                expect(task?.sat.getTime()).toBe(nextRunAtExplicit.getTime());
                expect((task?.n.d as Maybe<NotificationTaskBotRunNotificationTaskData>)?.x).toBe(true);
              });

              it('should not run a run scheduled in the future immediately', async () => {
                const nextRunAtExplicit = addHours(new Date(), 5);
                const result = await callUpdate({ nextRunAtExplicit, runImmediately: true });
                const entry = await loadEntry();
                const task = await loadTask(result.taskKey as string);

                expect(result.runResult).toBeFalsy();
                expect(entry.sc).toBe(0);
                expect(task?.d).toBe(false);
                expect(task?.sat.getTime()).toBe(nextRunAtExplicit.getTime());
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

              describe('data patch', () => {
                it('should merge a data patch without touching the live run', async () => {
                  const before = await loadEntry();
                  const result = await callUpdate({ updateData: { pa: 5 } });
                  const entry = await loadEntry();

                  expect(entry.d).toEqual({ iv: MS_IN_HOUR, pa: 5 });
                  expect(entry.rn).toBe(before.rn);
                  expect(entry.nk).toBe(before.nk);
                  expect(result.taskKey).toBe(before.nk);
                  expect(result.status).toBe(NotificationTaskBotEntryStatus.SCHEDULED);
                });

                it('should delete a data key set to null', async () => {
                  await callUpdate({ updateData: { pa: 5 } });
                  await callUpdate({ updateData: { pa: null, c: 2 } });
                  const entry = await loadEntry();

                  expect(entry.d).toEqual({ iv: MS_IN_HOUR, c: 2 });
                });

                it('should patch a disabled entry without scheduling a run', async () => {
                  await callUpdate({ s: NotificationTaskBotEntryState.DISABLED });
                  const result = await callUpdate({ updateData: { c: 0 } });
                  const entry = await loadEntry();

                  expect(entry.s).toBe(NotificationTaskBotEntryState.DISABLED);
                  expect(entry.rn).toBeFalsy();
                  expect(entry.d?.c).toBe(0);
                  expect(result.status).toBe(NotificationTaskBotEntryStatus.DISABLED);
                });

                it('should patch the data and resume in one request', async () => {
                  await callUpdate({ pause: true });
                  const result = await callUpdate({ updateData: { c: 0 }, pause: false });
                  const entry = await loadEntry();

                  expect(entry.pat).toBeFalsy();
                  expect(entry.d?.c).toBe(0);
                  expect(result.taskKey).toBe(entry.nk);
                  expect(await loadTask(result.taskKey as string)).toBeDefined();
                });

                it('should patch the data and reschedule in one request', async () => {
                  const before = await loadEntry();
                  await callUpdate({ updateData: { iv: 2 * MS_IN_HOUR }, nextRunAt: null });
                  const entry = await loadEntry();

                  expect(entry.rn).toBeGreaterThan(before.rn as number);
                  expect(await loadTask(before.nk as string)).toBeUndefined();
                  expect(entry.d?.iv).toBe(2 * MS_IN_HOUR);
                });

                it('should run the live run with the patched data', async () => {
                  const result = await callUpdate({ updateData: { pa: 1 }, runImmediately: true });
                  const entry = await loadEntry();

                  expect(result.runResult?.success).toBe(true);
                  expect(entry.sc).toBe(1);
                  expect(entry.d).toEqual({ iv: MS_IN_HOUR, pa: 1, c: 1 });
                  expect(entry.pr).toBe(DEMO_PING_NOTIFICATION_TASK_BOT_PAUSE_REASON_LIMIT);
                });

                itShouldFail('with DATA_PATCH_INVALID for data the script refuses', async () => {
                  const before = await loadEntry();
                  await expectFail(() => callUpdate({ updateData: { iv: -5 } }), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_TASK_BOT_ENTRY_DATA_PATCH_INVALID_ERROR_CODE));
                  const entry = await loadEntry();

                  expect(entry.d).toEqual(before.d);
                });

                itShouldFail('with DATA_PATCH_INVALID for a key the script does not declare', async () => {
                  await expectFail(() => callUpdate({ updateData: { ivv: 5 } }), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_TASK_BOT_ENTRY_DATA_PATCH_INVALID_ERROR_CODE));
                });

                itShouldFail('with DATA_PATCH_INVALID and apply nothing else in the request', async () => {
                  const before = await loadEntry();
                  await expectFail(() => callUpdate({ updateData: { iv: -5 }, pause: true }), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_TASK_BOT_ENTRY_DATA_PATCH_INVALID_ERROR_CODE));
                  const entry = await loadEntry();

                  expect(entry.pat).toBeFalsy();
                  expect(entry.nk).toBe(before.nk);
                });

                itShouldFail('with VALIDATION_ERROR for an array patch', async () => {
                  await expectFail(() => callUpdate({ updateData: [1] as unknown as UpdateNotificationTaskBotEntryParams['updateData'] }), expectFailAssertHttpErrorServerErrorCode(FIREBASE_SERVER_VALIDATION_ERROR_CODE));
                });
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

              it('should hand a MANUAL run that is not due over to a SCHEDULED run', async () => {
                await callRun({ trigger: NotificationTaskBotRunTrigger.FORCED }); // sets lsat
                const result = await callRun({});
                const entry = await loadEntry();
                const liveTask = await loadTask(entry.nk as string);

                expect(result.runResult?.success).toBe(true);
                expect(entry.h).toHaveLength(1);
                expect(entry.nk).not.toBe(result.taskKey);
                expect((liveTask?.n.d as Maybe<NotificationTaskBotRunNotificationTaskData>)?.tr).toBe(NotificationTaskBotRunTrigger.SCHEDULED);
              });

              it('should create and run a FORCED run', async () => {
                const result = await callRun({ trigger: NotificationTaskBotRunTrigger.FORCED });
                const entry = await loadEntry();

                expect(result.taskKey).toBeDefined();
                expect(result.runResult?.success).toBe(true);
                expect(entry.sc).toBe(1);
                expect(entry.h[entry.h.length - 1].tr).toBe(NotificationTaskBotRunTrigger.FORCED);
              });

              it("should resume an entry paused with 'failed' and run it with FORCED", async () => {
                await pauseWithFailed();

                const result = await callRun({ trigger: NotificationTaskBotRunTrigger.FORCED });
                const entry = await loadEntry();
                const last = entry.h[entry.h.length - 1];

                expect(result.runResult?.success).toBe(true);
                expect(entry.pat).toBeFalsy();
                expect(entry.sc).toBe(1);
                expect(entry.fc).toBe(0);
                expect(last.tr).toBe(NotificationTaskBotRunTrigger.FORCED);
                expect(last.o).toBe(NotificationTaskBotRunOutcome.SUBMITTED);
              });

              itShouldFail("for a MANUAL run on an entry paused with 'failed'", async () => {
                await pauseWithFailed();
                await expectFail(() => callRun({ trigger: NotificationTaskBotRunTrigger.MANUAL }), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_TASK_BOT_ENTRY_NOT_RUNNABLE_ERROR_CODE));
              });

              itShouldFail('for a FORCED run on a manually paused entry', async () => {
                await callUpdate({ pause: true });
                await expectFail(() => callRun({ trigger: NotificationTaskBotRunTrigger.FORCED }), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_TASK_BOT_ENTRY_NOT_RUNNABLE_ERROR_CODE));
              });

              itShouldFail("for a FORCED run on a disabled entry paused with 'failed'", async () => {
                await pauseWithFailed();
                await callUpdate({ s: NotificationTaskBotEntryState.DISABLED });
                await expectFail(() => callRun({ trigger: NotificationTaskBotRunTrigger.FORCED }), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_TASK_BOT_ENTRY_NOT_RUNNABLE_ERROR_CODE));
              });

              itShouldFail('for a paused entry', async () => {
                await callUpdate({ pause: true });
                await expectFail(() => callRun({}), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_TASK_BOT_ENTRY_NOT_RUNNABLE_ERROR_CODE));
              });

              itShouldFail('for an entry paused until a time', async () => {
                await callUpdate({ pauseUntil: addHours(new Date(), 2) });
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
              await expectFail(() => u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(notificationTaskBotIdentity, { key: ntb.documentKey, i: entryId, updateData: { c: 0 } }, 'entry')), expectFailAssertHttpErrorServerErrorCode(FORBIDDEN_ERROR_CODE));
            });
          });
        });
      });

      describe('data patch for a script without a dataType', () => {
        demoAuthorizedUserAdminContext({ f }, (u) => {
          demoProfileContext({ f, u }, (p) => {
            demoNotificationTaskBotContext({ f, for: p, entries: unknownScriptEntries }, (ntb) => {
              function callUpdate(params: Omit<UpdateNotificationTaskBotEntryParams, 'key' | 'i'>): Promise<UpdateNotificationTaskBotEntryResult> {
                return u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(notificationTaskBotIdentity, { key: ntb.documentKey, i: unknownScriptEntryId, ...params }, 'entry')) as Promise<UpdateNotificationTaskBotEntryResult>;
              }

              async function loadEntry() {
                const bot = await assertSnapshotData(ntb.document);
                return notificationTaskBotEntry(bot, unknownScriptEntryId)!;
              }

              itShouldFail('with DATA_PATCH_NOT_ALLOWED for a script without a dataType', async () => {
                await expectFail(() => callUpdate({ updateData: { a: 2 } }), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_TASK_BOT_ENTRY_DATA_PATCH_NOT_ALLOWED_ERROR_CODE));
                const entry = await loadEntry();

                expect(entry.d).toEqual({ a: 1 });
              });

              it('should ignore an empty patch', async () => {
                const result = await callUpdate({ updateData: {} });
                const entry = await loadEntry();

                expect(result.status).toBe(NotificationTaskBotEntryStatus.IDLE);
                expect(entry.d).toEqual({ a: 1 });
              });
            });
          });
        });
      });

      describe('owner opt-outs', () => {
        demoAuthorizedUserContext({ f }, (u) => {
          demoProfileContext({ f, u }, (p) => {
            demoNotificationTaskBotContext({ f, for: p, owner: p, entries: ownedEntries }, (ntb) => {
              const loadTask = (key: string) => getDocumentSnapshotData(f.demoFirestoreCollections.notificationCollectionGroup.documentAccessor().loadDocumentForKey(key));

              function callReadOptOuts(caller: typeof u = u, params?: Partial<ReadNotificationTaskBotOptOutsParams>): Promise<NotificationTaskBotOptOutsResult> {
                return caller.callWrappedFunction(demoCallModelWrappedFn, onCallReadModelParams(notificationTaskBotIdentity, { key: ntb.documentKey, ...params }, 'optOuts')) as Promise<NotificationTaskBotOptOutsResult>;
              }

              function callUpdateOptOut(params: Omit<UpdateNotificationTaskBotOptOutParams, 'key'>, caller: typeof u = u): Promise<NotificationTaskBotOptOutsResult> {
                return caller.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(notificationTaskBotIdentity, { key: ntb.documentKey, ...params }, 'optOut')) as Promise<NotificationTaskBotOptOutsResult>;
              }

              async function loadEntry(i: NotificationTaskBotEntryId) {
                const bot = await assertSnapshotData(ntb.document);
                return notificationTaskBotEntry(bot, i)!;
              }

              it('should store the owner key on the bot', async () => {
                const bot = await assertSnapshotData(ntb.document);
                expect(bot.o).toBe(p.documentKey);
              });

              describe('owner', () => {
                it('should read only the groups it can opt out of', async () => {
                  const result = await callReadOptOuts();

                  expect(result.groups.map((x) => x.key)).toEqual([pingGroupKey]);
                  expect(result.groups[0].name).toBe(DEMO_PING_NOTIFICATION_TASK_BOT_GROUP.name);
                  expect(result.groups[0].optOutAt).toBeFalsy();
                });

                it('should opt out of the group, stopping only the opt-out-able entry', async () => {
                  const pingBefore = await loadEntry(entryId);
                  const requiredBefore = await loadEntry(requiredEntryId);
                  expect(pingBefore.nk).toBeDefined();
                  expect(requiredBefore.nk).toBeDefined();

                  const result = await callUpdateOptOut({ optOut: [pingGroupKey] });
                  const ping = await loadEntry(entryId);
                  const required = await loadEntry(requiredEntryId);

                  expect(result.groups[0].optOutAt).toBeDefined();
                  expect(ping.oat).toBeDefined();
                  expect(ping.rn).toBeFalsy();
                  expect(await loadTask(pingBefore.nk as string)).toBeUndefined();

                  expect(required.oat).toBeFalsy();
                  expect(required.nk).toBe(requiredBefore.nk);
                  expect(await loadTask(required.nk as string)).toBeDefined();
                });

                it('should opt back into the group and reschedule the entry', async () => {
                  await callUpdateOptOut({ optOut: [pingGroupKey] });
                  const result = await callUpdateOptOut({ optIn: [pingGroupKey] });
                  const ping = await loadEntry(entryId);

                  expect(result.groups[0].optOutAt).toBeFalsy();
                  expect(ping.oat).toBeFalsy();
                  expect(ping.nk).toBeDefined();
                  expect(await loadTask(ping.nk as string)).toBeDefined();
                });

                itShouldFail('with NOT_ALLOWED for a group it is not listed', async () => {
                  await expectFail(() => callUpdateOptOut({ optOut: ['not_a_group'] }), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_TASK_BOT_OPT_OUT_NOT_ALLOWED_ERROR_CODE));
                });

                itShouldFail('with NOT_ALLOWED for a group in both lists', async () => {
                  await expectFail(() => callUpdateOptOut({ optOut: [pingGroupKey], optIn: [pingGroupKey] }), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_TASK_BOT_OPT_OUT_NOT_ALLOWED_ERROR_CODE));
                });

                itShouldFail('with MODEL_NOT_AVAILABLE for a bot that does not exist', async () => {
                  const missingBotKey = notificationTaskBotKeyForModel(firestoreModelKey(profileIdentity, 'missing'));
                  await expectFail(() => callReadOptOuts(u, { key: missingBotKey }), expectFailAssertHttpErrorServerErrorCode(MODEL_NOT_AVAILABLE_ERROR_CODE));
                });
              });

              demoAuthorizedUserAdminContext({ f }, (au) => {
                describe('admin', () => {
                  function callAdminUpdate(params: Omit<UpdateNotificationTaskBotEntryParams, 'key' | 'i'>): Promise<UpdateNotificationTaskBotEntryResult> {
                    return au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(notificationTaskBotIdentity, { key: ntb.documentKey, i: entryId, ...params }, 'entry')) as Promise<UpdateNotificationTaskBotEntryResult>;
                  }

                  it('should read the opt-outs', async () => {
                    await callUpdateOptOut({ optOut: [pingGroupKey] });
                    const result = await callReadOptOuts(au);

                    expect(result.groups.map((x) => x.key)).toEqual([pingGroupKey]);
                    expect(result.groups[0].optOutAt).toBeDefined();
                  });

                  it('should report opted_out and schedule no run when resuming an opted-out entry', async () => {
                    await callAdminUpdate({ pause: true });
                    await callUpdateOptOut({ optOut: [pingGroupKey] });

                    const result = await callAdminUpdate({ pause: false });
                    const ping = await loadEntry(entryId);

                    expect(result.status).toBe(NotificationTaskBotEntryStatus.OPTED_OUT);
                    expect(result.taskKey).toBeFalsy();
                    expect(ping.pat).toBeFalsy();
                    expect(ping.oat).toBeDefined();
                    expect(ping.rn).toBeFalsy();
                  });

                  itShouldFail('with ENTRY_OPTED_OUT to run an opted-out entry', async () => {
                    await callUpdateOptOut({ optOut: [pingGroupKey] });
                    await expectFail(() => au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(notificationTaskBotIdentity, { key: ntb.documentKey, i: entryId }, 'run')), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_TASK_BOT_ENTRY_OPTED_OUT_ERROR_CODE));
                  });

                  itShouldFail('with REQUIRES_OWNER to opt the owner out or back in', async () => {
                    await expectFail(() => callUpdateOptOut({ optOut: [pingGroupKey] }, au), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_TASK_BOT_OPT_OUT_REQUIRES_OWNER_ERROR_CODE));

                    await callUpdateOptOut({ optOut: [pingGroupKey] });
                    await expectFail(() => callUpdateOptOut({ optIn: [pingGroupKey] }, au), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_TASK_BOT_OPT_OUT_REQUIRES_OWNER_ERROR_CODE));
                  });
                });
              });

              demoAuthorizedUserContext({ f }, (u2) => {
                itShouldFail('with FORBIDDEN for another user', async () => {
                  await expectFail(() => callReadOptOuts(u2), expectFailAssertHttpErrorServerErrorCode(FORBIDDEN_ERROR_CODE));
                  await expectFail(() => callUpdateOptOut({ optOut: [pingGroupKey] }, u2), expectFailAssertHttpErrorServerErrorCode(FORBIDDEN_ERROR_CODE));
                });
              });
            });
          });
        });

        demoAuthorizedUserContext({ f }, (u) => {
          demoProfileContext({ f, u }, (p) => {
            demoNotificationTaskBotContext({ f, for: p, owner: p, entries: [requiredPingEntry] }, (ntb) => {
              it('should list no groups when the bot only has entries the owner can not opt out of', async () => {
                const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallReadModelParams(notificationTaskBotIdentity, { key: ntb.documentKey }, 'optOuts'))) as NotificationTaskBotOptOutsResult;
                expect(result.groups).toEqual([]);
              });

              itShouldFail('with NOT_ALLOWED for a group with no opt-out-able entry', async () => {
                await expectFail(() => u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(notificationTaskBotIdentity, { key: ntb.documentKey, optOut: [pingGroupKey] }, 'optOut')), expectFailAssertHttpErrorServerErrorCode(NOTIFICATION_TASK_BOT_OPT_OUT_NOT_ALLOWED_ERROR_CODE));
              });
            });
          });
        });

        demoAuthorizedUserAdminContext({ f }, (au) => {
          demoProfileContext({ f, u: au }, (ap) => {
            demoNotificationTaskBotContext({ f, for: ap, owner: ap, entries: pingEntries }, (ntb) => {
              it('should let an admin who owns the bot opt out and back in', async () => {
                const optOutResult = (await au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(notificationTaskBotIdentity, { key: ntb.documentKey, optOut: [pingGroupKey] }, 'optOut'))) as NotificationTaskBotOptOutsResult;
                expect(optOutResult.groups[0].optOutAt).toBeDefined();

                const optInResult = (await au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(notificationTaskBotIdentity, { key: ntb.documentKey, optIn: [pingGroupKey] }, 'optOut'))) as NotificationTaskBotOptOutsResult;
                expect(optInResult.groups[0].optOutAt).toBeFalsy();
              });
            });
          });
        });
      });

      describe('profile createTestNotificationTaskBot', () => {
        demoAuthorizedUserContext({ f }, (u) => {
          demoProfileContext({ f, u }, (p) => {
            it('should create the owned demo ping bot and be idempotent', async () => {
              const botDocument = f.demoFirestoreCollections.notificationTaskBotCollection.documentAccessor().loadDocumentForKey(notificationTaskBotKeyForModel(p.documentKey));
              const callCreate = () => u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(profileIdentity, { key: p.documentKey }, 'createTestNotificationTaskBot'));

              await callCreate();
              const bot = await assertSnapshotData(botDocument);
              const entry = notificationTaskBotEntry(bot, entryId)!;

              expect(bot.o).toBe(p.documentKey);
              expect(entry.t).toBe(DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE);
              expect(entry.nk).toBeDefined();

              await callCreate();
              const botAfter = await assertSnapshotData(botDocument);

              expect(botAfter.e).toHaveLength(1);
              expect(notificationTaskBotEntry(botAfter, entryId)!.nk).toBe(entry.nk);
            });
          });
        });
      });
    });
  });
});
