import { addHours, addMinutes } from 'date-fns';
import { demoApiFunctionContextFactory, demoAuthorizedUserContext, demoNotificationTaskBotContext, demoProfileContext } from '../../../test/fixture';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { assertSnapshotData } from '@dereekb/firebase-server';
import {
  createNotificationDocument,
  getDocumentSnapshotData,
  NOTIFICATION_TASK_BOT_PAUSE_REASON_MANUAL,
  NOTIFICATION_TASK_TYPE_MAX_SEND_ATTEMPTS,
  notificationBoxIdForModel,
  NotificationSendType,
  type NotificationTaskBotEntryData,
  type NotificationTaskBotEntrySeed,
  notificationTaskBotEntry,
  NotificationTaskBotEntryState,
  NotificationTaskBotEntryStatus,
  notificationTaskBotEntryStatus,
  type NotificationTaskBotRunNotificationTaskData,
  NotificationTaskBotRunOutcome,
  notificationTaskBotRunNotificationTaskTemplate,
  NotificationTaskBotRunTrigger,
  type NotificationTaskKey
} from '@dereekb/firebase';
import { applyNotificationTaskBotChangesFactory, ensureNotificationTaskBotEntryFactory, removeNotificationTaskBotEntryFactory, scheduleNotificationTaskBotEntryFactory } from '@dereekb/firebase-server/model';
import { DEMO_PING_NOTIFICATION_TASK_BOT_ENTRY_ID, DEMO_PING_NOTIFICATION_TASK_BOT_GROUP, DEMO_PING_NOTIFICATION_TASK_BOT_PAUSE_REASON_LIMIT, DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE } from 'demo-firebase';
import { type Maybe, MS_IN_HOUR, MS_IN_MINUTE } from '@dereekb/util';

const entryId = DEMO_PING_NOTIFICATION_TASK_BOT_ENTRY_ID;
const scriptType = DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE;

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('notification.scenario.taskbot', { f, fns: {} }, () => {
    demoAuthorizedUserContext({ f }, (u) => {
      demoProfileContext({ f, u }, (p) => {
        demoNotificationTaskBotContext({ f, for: p }, (ntb) => {
          const model = () => p.documentKey;
          const taskAccessor = () => f.demoFirestoreCollections.notificationCollectionGroup.documentAccessor();
          const loadTask = (key: NotificationTaskKey) => getDocumentSnapshotData(taskAccessor().loadDocumentForKey(key));

          async function ensure(data?: NotificationTaskBotEntryData, schedule?: 'ifIdle' | 'now' | Date | false, seed?: NotificationTaskBotEntrySeed) {
            return ensureNotificationTaskBotEntryFactory(f.serverActionsContext)({ model: model(), entryId, scriptType, data, schedule, seed });
          }

          async function applyChanges(changes: Parameters<ReturnType<typeof applyNotificationTaskBotChangesFactory>>[0]['changes']) {
            return applyNotificationTaskBotChangesFactory(f.serverActionsContext)({ model: model(), changes });
          }

          function taskData(task: Maybe<{ readonly n: { readonly d?: unknown } }>) {
            return task?.n.d as Maybe<NotificationTaskBotRunNotificationTaskData>;
          }

          async function loadEntry() {
            return notificationTaskBotEntry(await assertSnapshotData(ntb.document), entryId)!;
          }

          async function sendRun(key: NotificationTaskKey) {
            const send = await f.notificationServerActions.sendNotification({ key, ignoreSendAtThrottle: true });
            return send(taskAccessor().loadDocumentForKey(key));
          }

          async function sendLiveRun() {
            return sendRun((await loadEntry()).nk as NotificationTaskKey);
          }

          describe('ensure', () => {
            it('should create the bot and its first run, and a repeat ensure should be a no-op', async () => {
              const first = await ensure({ iv: MS_IN_HOUR });
              expect(first.createRuns).toHaveLength(1);

              const bot = await assertSnapshotData(ntb.document);
              expect(bot.m).toBe(model());
              expect(bot.rc).toBe(1);
              expect(await loadTask(bot.e[0].nk as string)).toBeDefined();

              const second = await ensure({ iv: 5 });
              expect(second.changed).toBe(false);
              expect((await assertSnapshotData(ntb.document)).rc).toBe(1);
            });
          });

          describe('running', () => {
            it('should run processing and cleanup in one send', async () => {
              await ensure({ iv: MS_IN_HOUR });
              const before = await loadEntry();

              const result = await sendLiveRun();
              expect(result.success).toBe(true);

              const entry = await loadEntry();
              const finishedTask = await loadTask(before.nk as string);

              expect(finishedTask?.d).toBe(true);
              expect(entry.sc).toBe(1);
              expect(entry.d?.['c']).toBe(1);
              expect(entry.lsr).toBe(before.rn);
              expect(entry.h).toHaveLength(1);
              expect(entry.h[0].o).toBe(NotificationTaskBotRunOutcome.SUBMITTED);
              expect(entry.rn).toBe((before.rn as number) + 1);
              expect(await loadTask(entry.nk as string)).toBeDefined();
            });

            it('should cap the history', async () => {
              // each cleanup run waits for the minimum run interval, so every run is re-armed due now first
              for (let i = 0; i < 4; i += 1) {
                await ensure(i === 0 ? { iv: 1 } : undefined, 'now');
                await sendLiveRun();
              }

              const entry = await loadEntry();
              expect(entry.sc).toBe(4);
              expect(entry.h).toHaveLength(3); // DEMO_PING historyLimit
            });

            it('should re-delay a run that is not due yet without recording history or an attempt', async () => {
              await ensure({ iv: MS_IN_HOUR });
              await sendLiveRun(); // first run sends and sets lsat
              await ensure(undefined, 'now'); // a SCHEDULED run due now, so the script's due check decides

              const entry = await loadEntry();
              await sendRun(entry.nk as string);

              const after = await loadEntry();
              const task = await loadTask(entry.nk as string);

              expect(after.h).toHaveLength(1);
              expect(after.rn).toBe(entry.rn);
              expect(task?.d).toBe(false);
              expect(task?.a).toBe(0);
              expect(task?.sat.getTime()).toBeGreaterThan(Date.now() + MS_IN_HOUR / 2);
              expect(after.nat?.getTime()).toBe((entry.lsat as Date).getTime() + MS_IN_HOUR);
            });

            it('should still apply the due check to a MANUAL run but skip it for a FORCED run', async () => {
              await ensure({ iv: MS_IN_HOUR });
              await sendLiveRun();

              await scheduleNotificationTaskBotEntryFactory(f.serverActionsContext)({ model: model(), entryId, trigger: NotificationTaskBotRunTrigger.MANUAL });
              await sendLiveRun();

              const deferred = await loadEntry();
              expect(deferred.sc).toBe(1); // handed over to a SCHEDULED run
              expect(taskData(await loadTask(deferred.nk as string))?.tr).toBe(NotificationTaskBotRunTrigger.SCHEDULED);

              await scheduleNotificationTaskBotEntryFactory(f.serverActionsContext)({ model: model(), entryId, trigger: NotificationTaskBotRunTrigger.FORCED });
              await sendLiveRun();

              const entry = await loadEntry();
              expect(entry.sc).toBe(2);
              expect(entry.h[entry.h.length - 1].tr).toBe(NotificationTaskBotRunTrigger.FORCED);
            });

            it('should fence a stale run so it writes nothing', async () => {
              await ensure({ iv: MS_IN_HOUR });
              const bot = await assertSnapshotData(ntb.document);

              const stale = await createNotificationDocument({
                context: f.demoFirestoreCollections,
                template: notificationTaskBotRunNotificationTaskTemplate({ model: model(), botKey: ntb.documentKey, botId: ntb.documentId, entryId, scriptType, runNumber: 99, trigger: NotificationTaskBotRunTrigger.FORCED, sendAt: new Date() })
              });

              await sendRun(stale.notificationDocument.key);

              const entry = await loadEntry();
              expect(entry.sc).toBe(0);
              expect(entry.h).toHaveLength(0);
              expect(entry.rn).toBe(bot.e[0].rn);
              expect((await loadTask(stale.notificationDocument.key))?.d).toBe(true);
            });

            it('should not submit twice when the run already submitted', async () => {
              await ensure({ iv: MS_IN_HOUR });
              const entry = await loadEntry();

              // simulate a ping step that submitted but crashed before the step completed
              await applyNotificationTaskBotChangesFactory(f.serverActionsContext)({ model: model(), changes: [{ type: 'markSubmitted', entryId, runNumber: entry.rn as number }] });
              await sendLiveRun();

              const after = await loadEntry();
              expect(after.sc).toBe(1);
              expect(after.d?.['c']).toBeUndefined();
              expect(after.h[0].o).toBe(NotificationTaskBotRunOutcome.SUBMITTED);
            });

            it('should pause the entry when the script requests it', async () => {
              await ensure({ iv: 1, pa: 1 });
              await sendLiveRun();

              const entry = await loadEntry();
              expect(entry.pr).toBe(DEMO_PING_NOTIFICATION_TASK_BOT_PAUSE_REASON_LIMIT);
              expect(entry.rn).toBeFalsy();
            });

            it('should hand a MANUAL run that is not due over to a SCHEDULED run at the due time', async () => {
              await ensure({ iv: MS_IN_HOUR });
              await sendLiveRun(); // sets lsat

              await scheduleNotificationTaskBotEntryFactory(f.serverActionsContext)({ model: model(), entryId, trigger: NotificationTaskBotRunTrigger.MANUAL });
              const manual = await loadEntry();
              await sendLiveRun();

              const entry = await loadEntry();
              const due = (entry.lsat as Date).getTime() + MS_IN_HOUR;
              const manualTask = await loadTask(manual.nk as string);
              const handOver = await loadTask(entry.nk as string);

              expect(entry.sc).toBe(1);
              expect(entry.h).toHaveLength(1);
              expect(manualTask?.d).toBe(true);
              expect(entry.rn).toBe((manual.rn as number) + 1);
              expect(taskData(handOver)?.tr).toBe(NotificationTaskBotRunTrigger.SCHEDULED);
              expect(taskData(handOver)?.x).toBeFalsy();
              expect(taskData(handOver)?.sa).toBe(due);
              expect(handOver?.sat.getTime()).toBe(due);
              expect(entry.nat?.getTime()).toBe(due);
            });

            it('should not start an explicit run before its time when woken early', async () => {
              const at = addHours(new Date(), 5);
              await ensure({ iv: MS_IN_HOUR }, false);
              await scheduleNotificationTaskBotEntryFactory(f.serverActionsContext)({ model: model(), entryId, at, explicit: true });

              const entry = await loadEntry();
              await sendRun(entry.nk as string); // ignores the send-at throttle

              const after = await loadEntry();
              const task = await loadTask(entry.nk as string);

              expect(after.sc).toBe(0);
              expect(after.h).toHaveLength(0);
              expect(task?.a).toBe(0);
              expect(task?.d).toBe(false);
              expect(task?.sat.getTime()).toBe(at.getTime());
            });

            it('should apply the due check to a not-before run at its time', async () => {
              await ensure({ iv: MS_IN_HOUR });
              await sendLiveRun(); // sets lsat

              await scheduleNotificationTaskBotEntryFactory(f.serverActionsContext)({ model: model(), entryId, at: new Date(Date.now() - 1000) });
              await sendLiveRun();

              const entry = await loadEntry();
              expect(entry.sc).toBe(1); // delayed by the due check
              expect(entry.nat?.getTime()).toBe((entry.lsat as Date).getTime() + MS_IN_HOUR);

              // the same run made explicit skips the due check
              await scheduleNotificationTaskBotEntryFactory(f.serverActionsContext)({ model: model(), entryId, at: new Date(Date.now() - 1000), explicit: true });
              await sendLiveRun();

              expect((await loadEntry()).sc).toBe(2);
            });

            it('should count a failed step as a failed attempt and retry after the failure delay', async () => {
              await ensure({ iv: MS_IN_HOUR, f: true });
              const entry = await loadEntry();

              const result = await sendLiveRun();
              const task = await loadTask(entry.nk as string);
              const after = await loadEntry();

              expect(result.success).toBe(false);
              expect(task?.a).toBe(1);
              expect(task?.d).toBe(false);
              expect(task?.sat.getTime()).toBeGreaterThan(Date.now() + 2 * MS_IN_HOUR);
              expect(after.sc).toBe(0);
              expect(after.h).toHaveLength(0);

              // once it runs out of attempts the task is deleted, and repair records the run as lost
              await taskAccessor()
                .loadDocumentForKey(entry.nk as string)
                .accessor.update({ a: NOTIFICATION_TASK_TYPE_MAX_SEND_ATTEMPTS });
              await sendRun(entry.nk as string);
              expect(await loadTask(entry.nk as string)).toBeUndefined();

              await f.notificationServerActions.repairAllNotificationTaskBots({ now: addHours(new Date(), 2) });

              const repaired = await loadEntry();
              expect(repaired.h[0].o).toBe(NotificationTaskBotRunOutcome.LOST);
              expect(repaired.fc).toBe(1);
              expect(repaired.rn).toBe((entry.rn as number) + 1);
            });

            it('should record SKIPPED for an entry whose script has no processor', async () => {
              await ensureNotificationTaskBotEntryFactory(f.serverActionsContext)({ model: model(), entryId, scriptType: 'demo_unknown' });
              await sendLiveRun(); // processing completes without a processor
              await sendLiveRun(); // cleanup records the outcome

              const entry = await loadEntry();
              expect(entry.h).toHaveLength(1);
              expect(entry.h[0].o).toBe(NotificationTaskBotRunOutcome.SKIPPED);
              expect(notificationTaskBotEntryStatus(entry)).toBe(NotificationTaskBotEntryStatus.IDLE);
            });

            it("should run a 'run again now' entry once per queue pass", async () => {
              await ensure({ iv: 1 });

              const sendQueuedNotifications = await f.notificationServerActions.sendQueuedNotifications({ maxSendNotificationLoops: 5 });
              await sendQueuedNotifications();

              const entry = await loadEntry();
              const task = await loadTask(entry.nk as string);

              expect(entry.sc).toBe(1);
              expect(task?.sat.getTime()).toBeGreaterThanOrEqual(Date.now() + 4 * MS_IN_MINUTE);
            });

            it('should remove the entry when the attached profile was deleted', async () => {
              async function countSentNotifications() {
                const boxDocument = f.demoFirestoreCollections.notificationBoxCollection.documentAccessor().loadDocumentForId(notificationBoxIdForModel(model()));
                const notifications = await f.demoFirestoreCollections.notificationCollectionFactory(boxDocument).queryDocument().getDocs();
                const notificationsData = await Promise.all(notifications.map((x) => getDocumentSnapshotData(x)));
                return notificationsData.filter((x) => x != null && x.st !== NotificationSendType.TASK_NOTIFICATION).length;
              }

              await ensure({ iv: MS_IN_HOUR });
              const entry = await loadEntry();
              const sentBefore = await countSentNotifications();

              await p.document.accessor.delete();
              await sendLiveRun();

              const bot = await assertSnapshotData(ntb.document);

              expect(bot.e).toHaveLength(0);
              expect((await loadTask(entry.nk as string))?.d).toBe(true);
              expect(await countSentNotifications()).toBe(sentBefore);
            });
          });

          describe('resume', () => {
            it('should restart the ping count after a resume from the limit', async () => {
              await ensure({ iv: 1, pa: 2 }, 'now');
              await sendLiveRun();
              await ensure(undefined, 'now');
              await sendLiveRun();

              const limited = await loadEntry();
              expect(limited.pr).toBe(DEMO_PING_NOTIFICATION_TASK_BOT_PAUSE_REASON_LIMIT);
              expect(limited.d?.['c']).toBe(2);

              await applyChanges([{ type: 'pause', entryId, pause: false }]);
              expect((await loadEntry()).rpr).toBe(DEMO_PING_NOTIFICATION_TASK_BOT_PAUSE_REASON_LIMIT);

              await sendLiveRun();

              const entry = await loadEntry();
              expect(entry.d?.['c']).toBe(1);
              expect(entry.pat).toBeFalsy();
              expect(entry.rpr).toBeFalsy();
              expect(entry.sc).toBe(3);
              expect(entry.rn).toBeTruthy();
            });
          });

          describe('pause until', () => {
            it('should pause until a time and resume on its own', async () => {
              await ensure({ iv: MS_IN_HOUR });
              await applyChanges([{ type: 'pause', entryId, pause: { reason: NOTIFICATION_TASK_BOT_PAUSE_REASON_MANUAL, until: new Date() } }]);

              const paused = await loadEntry();
              expect(notificationTaskBotEntryStatus(paused)).toBe(NotificationTaskBotEntryStatus.PAUSED);
              expect(paused.nk).toBeTruthy();
              expect(paused.nat?.getTime()).toBe(paused.pu?.getTime());

              await sendLiveRun();

              const entry = await loadEntry();
              expect(entry.pat).toBeFalsy();
              expect(entry.pu).toBeFalsy();
              expect(entry.pr).toBeFalsy();
              expect(entry.sc).toBe(1);
              expect(entry.rpr).toBeFalsy(); // cleared again by the completed run
              expect(entry.h[0].o).toBe(NotificationTaskBotRunOutcome.SUBMITTED);
            });

            it('should hold a paused-until run that is woken early', async () => {
              await ensure({ iv: MS_IN_HOUR });
              const until = addHours(new Date(), 2);
              await applyChanges([{ type: 'pause', entryId, pause: { reason: NOTIFICATION_TASK_BOT_PAUSE_REASON_MANUAL, until } }]);

              const paused = await loadEntry();
              await sendRun(paused.nk as string);

              const entry = await loadEntry();
              const task = await loadTask(paused.nk as string);

              expect(notificationTaskBotEntryStatus(entry)).toBe(NotificationTaskBotEntryStatus.PAUSED);
              expect(entry.pu?.getTime()).toBe(until.getTime());
              expect(task?.sat.getTime()).toBe(until.getTime());
              expect(entry.sc).toBe(0);
            });
          });

          describe('seed', () => {
            it('should seed a new entry for migration', async () => {
              const seededLsat = addMinutes(new Date(), -10);
              const h = [1, 2, 3, 4, 5].map((i) => ({ at: addHours(new Date(), -10 + i), tr: NotificationTaskBotRunTrigger.SCHEDULED, o: NotificationTaskBotRunOutcome.SUBMITTED, d: { n: i } }));

              await ensure({ iv: MS_IN_HOUR }, undefined, { lsat: seededLsat, sc: 5, h });

              const seeded = await loadEntry();
              expect(seeded.sc).toBe(5);
              expect(seeded.h).toHaveLength(3); // the demo_ping history limit
              expect(seeded.h.map((x) => x.rn)).toEqual([0, 0, 0]);
              expect(seeded.h.map((x) => x.d?.['n'])).toEqual([3, 4, 5]);
              expect((await assertSnapshotData(ntb.document)).rc).toBe(1);
              expect(seeded.rn).toBe(1);

              await sendLiveRun();

              const delayed = await loadEntry();
              expect(delayed.sc).toBe(5);
              expect(delayed.nat?.getTime()).toBe(seededLsat.getTime() + MS_IN_HOUR);

              await scheduleNotificationTaskBotEntryFactory(f.serverActionsContext)({ model: model(), entryId, trigger: NotificationTaskBotRunTrigger.FORCED });
              await sendLiveRun();

              const entry = await loadEntry();
              const last = entry.h[entry.h.length - 1];

              expect(entry.sc).toBe(6);
              expect(last.o).toBe(NotificationTaskBotRunOutcome.SUBMITTED);
              expect(last.tr).toBe(NotificationTaskBotRunTrigger.FORCED);
            });

            it('should seed a paused entry with no run', async () => {
              await ensure({ iv: MS_IN_HOUR }, undefined, { pause: { reason: 'no_progress' } });

              const entry = await loadEntry();
              expect(notificationTaskBotEntryStatus(entry)).toBe(NotificationTaskBotEntryStatus.PAUSED);
              expect(entry.pr).toBe('no_progress');
              expect(entry.rn).toBeFalsy();
            });
          });

          describe('scheduling', () => {
            it('should re-arm an idle entry with ensure ifIdle', async () => {
              await ensure({ iv: MS_IN_HOUR }, false);
              expect((await loadEntry()).rn).toBeFalsy();

              const result = await ensure(undefined, 'ifIdle');
              expect(result.createRuns).toHaveLength(1);
              expect((await loadEntry()).rn).toBe(1);
            });

            it('should delete the pending run when the entry is disabled or removed', async () => {
              await ensure({ iv: MS_IN_HOUR });
              const first = await loadEntry();

              await applyNotificationTaskBotChangesFactory(f.serverActionsContext)({ model: model(), changes: [{ type: 'state', entryId, state: NotificationTaskBotEntryState.DISABLED }] });
              expect(await loadTask(first.nk as string)).toBeUndefined();

              await applyNotificationTaskBotChangesFactory(f.serverActionsContext)({ model: model(), changes: [{ type: 'state', entryId, state: NotificationTaskBotEntryState.ENABLED }] });
              const second = await loadEntry();
              expect(await loadTask(second.nk as string)).toBeDefined();

              await removeNotificationTaskBotEntryFactory(f.serverActionsContext)({ model: model(), entryId });
              expect(await loadTask(second.nk as string)).toBeUndefined();
              expect((await assertSnapshotData(ntb.document)).e).toHaveLength(0);
            });

            it('should not clobber other entries', async () => {
              await ensure({ iv: MS_IN_HOUR });
              await ensureNotificationTaskBotEntryFactory(f.serverActionsContext)({ model: model(), entryId: 'other', scriptType, schedule: false, data: { iv: 5 } });
              await sendLiveRun();

              const bot = await assertSnapshotData(ntb.document);
              expect(bot.e).toHaveLength(2);
              expect(notificationTaskBotEntry(bot, 'other')?.d).toEqual({ iv: 5 });
              expect(notificationTaskBotEntry(bot, entryId)?.sc).toBe(1);
            });
          });

          describe('owner opt-out', () => {
            async function optOut(value: boolean) {
              return applyNotificationTaskBotChangesFactory(f.serverActionsContext)({ model: model(), changes: [{ type: 'optOut', group: DEMO_PING_NOTIFICATION_TASK_BOT_GROUP.key, optOut: value }] });
            }

            it('should delete the pending run so it never sends', async () => {
              await ensure({ iv: MS_IN_HOUR });
              const before = await loadEntry();

              const result = await optOut(true);
              const entry = await loadEntry();

              expect(result.deleteTaskKeys).toEqual([before.nk]);
              expect(await loadTask(before.nk as string)).toBeUndefined();
              expect(entry.oat).toBeDefined();
              expect(entry.rn).toBeFalsy();
              expect(entry.sc).toBe(0);
            });

            it('should fence a recreated run of an opted-out entry so it writes nothing', async () => {
              await ensure({ iv: MS_IN_HOUR });
              const before = await loadEntry();
              await optOut(true);

              const recreated = await createNotificationDocument({
                context: f.demoFirestoreCollections,
                template: notificationTaskBotRunNotificationTaskTemplate({ model: model(), botKey: ntb.documentKey, botId: ntb.documentId, entryId, scriptType, runNumber: before.rn as number, trigger: NotificationTaskBotRunTrigger.FORCED, sendAt: new Date() })
              });

              await sendRun(recreated.notificationDocument.key);

              const entry = await loadEntry();
              expect(entry.sc).toBe(0);
              expect(entry.h).toHaveLength(0);
              expect(entry.rn).toBeFalsy();
              expect(entry.oat).toBeDefined();
              expect((await loadTask(recreated.notificationDocument.key))?.d).toBe(true);
            });

            it('should be ignored by repair', async () => {
              await ensure({ iv: MS_IN_HOUR });
              await optOut(true);

              const result = await f.notificationServerActions.repairAllNotificationTaskBots({ now: addHours(new Date(), 2) });
              expect(result.entriesRepaired).toBe(0);

              const entry = await loadEntry();
              expect(entry.rn).toBeFalsy();
              expect(entry.h).toHaveLength(0);
            });

            it('should schedule a new run when opted back in', async () => {
              await ensure({ iv: MS_IN_HOUR });
              const before = await loadEntry();
              await optOut(true);

              const result = await optOut(false);
              const entry = await loadEntry();

              expect(result.createRuns).toHaveLength(1);
              expect(entry.oat).toBeFalsy();
              expect(entry.rn).toBeGreaterThan(before.rn as number);
              expect(await loadTask(entry.nk as string)).toBeDefined();
            });
          });

          describe('repair', () => {
            it('should record a lost run and reschedule it', async () => {
              await ensure({ iv: MS_IN_HOUR });
              const entry = await loadEntry();
              await taskAccessor()
                .loadDocumentForKey(entry.nk as string)
                .accessor.delete();

              const result = await f.notificationServerActions.repairAllNotificationTaskBots({ now: addHours(new Date(), 2) });
              expect(result.entriesRepaired).toBe(1);

              const after = await loadEntry();
              expect(after.h[0].o).toBe(NotificationTaskBotRunOutcome.LOST);
              expect(after.fc).toBe(1);
              expect(after.rn).toBe((entry.rn as number) + 1);
              expect(await loadTask(after.nk as string)).toBeDefined();
            });

            it('should only sync nat for a run that is still pending', async () => {
              await ensure({ iv: MS_IN_HOUR });
              const entry = await loadEntry();

              const result = await f.notificationServerActions.repairAllNotificationTaskBots({ now: addHours(new Date(), 2) });
              expect(result.entriesSynced).toBe(1);

              const after = await loadEntry();
              const task = await loadTask(entry.nk as string);
              expect(after.rn).toBe(entry.rn);
              expect(after.nat?.getTime()).toBe(task?.sat.getTime());
              expect(after.h).toHaveLength(0);
            });
          });
        });
      });
    });
  });
});
