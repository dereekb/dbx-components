import { addHours, addMinutes } from 'date-fns';
import { demoApiFunctionContextFactory, demoAuthorizedUserContext, demoNotificationTaskBotContext, demoProfileContext } from '../../../test/fixture';
import { describeCallableRequestTest, expectNotificationTaskBotEntryHistory, expectNotificationTaskBotEntryStatus, notificationTaskBotRunTaskData } from '@dereekb/firebase-server/test';
import { assertSnapshotData } from '@dereekb/firebase-server';
import {
  appNotificationTaskBotScriptConfigService,
  createNotificationDocument,
  getDocumentSnapshotData,
  NOTIFICATION_TASK_BOT_PAUSE_REASON_FAILED,
  NOTIFICATION_TASK_BOT_PAUSE_REASON_MANUAL,
  notificationBoxIdForModel,
  NotificationSendType,
  type NotificationTaskBotEntryData,
  type NotificationTaskBotEntrySeed,
  notificationTaskBotEntry,
  NotificationTaskBotEntryState,
  NotificationTaskBotEntryStatus,
  NotificationTaskBotRunOutcome,
  notificationTaskBotRunNotificationTaskTemplate,
  NotificationTaskBotRunTrigger,
  type NotificationTaskBotScriptConfig,
  notificationTaskBotScriptConfigRecord,
  notificationTaskBotsStalledQuery,
  type RunNotificationTaskBotEntryParams
} from '@dereekb/firebase';
import { removeNotificationTaskBotEntryFactory, repairAllNotificationTaskBotsFactory } from '@dereekb/firebase-server/model';
import { DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS, DEMO_PING_NOTIFICATION_TASK_BOT_ENTRY_ID, DEMO_PING_NOTIFICATION_TASK_BOT_GROUP, DEMO_PING_NOTIFICATION_TASK_BOT_PAUSE_REASON_LIMIT, DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE } from 'demo-firebase';
import { MS_IN_HOUR, MS_IN_MINUTE } from '@dereekb/util';

const entryId = DEMO_PING_NOTIFICATION_TASK_BOT_ENTRY_ID;
const scriptType = DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE;

demoApiFunctionContextFactory((f) => {
  describeCallableRequestTest('notification.scenario.taskbot', { f, fns: {} }, () => {
    demoAuthorizedUserContext({ f }, (u) => {
      demoProfileContext({ f, u }, (p) => {
        demoNotificationTaskBotContext({ f, for: p, entryId }, (ntb) => {
          const ensure = (data?: NotificationTaskBotEntryData, schedule?: 'ifIdle' | 'now' | Date | false, seed?: NotificationTaskBotEntrySeed) => ntb.ensure({ scriptType, data, schedule, seed });

          // a repair sweep whose registry overrides every demo script's config, e.g. its lostRunPolicy
          function repairWithScriptConfig(update: Pick<NotificationTaskBotScriptConfig, 'lostRunPolicy' | 'maxConsecutiveFailures'>) {
            const scriptConfigService = appNotificationTaskBotScriptConfigService(notificationTaskBotScriptConfigRecord(DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS.map((x) => ({ ...x, ...update }))));
            return repairAllNotificationTaskBotsFactory({ ...f.serverActionsContext, appNotificationTaskBotScriptConfigService: scriptConfigService });
          }

          async function loseLiveRun() {
            const entry = await ntb.assertEntry();
            await ntb.loadRunTaskDocument(entry.nk as string).accessor.delete();
            return entry;
          }

          // update:run, through the same server action the callable uses
          async function runEntry(params: Omit<RunNotificationTaskBotEntryParams, 'key' | 'i'>) {
            const run = await f.notificationServerActions.runNotificationTaskBotEntry({ key: ntb.documentKey, i: entryId, ...params });
            return run(ntb.document);
          }

          // repair stamps stl with its own now (2h ahead in these specs), so query past it
          async function stalledBotKeys() {
            const docs = await f.demoFirestoreCollections.notificationTaskBotCollection.queryDocument(...notificationTaskBotsStalledQuery(addHours(new Date(), 3))).getDocs();
            return docs.map((x) => x.key);
          }

          describe('ensure', () => {
            it('should create the bot and its first run, and a repeat ensure should be a no-op', async () => {
              const first = await ensure({ iv: MS_IN_HOUR });
              expect(first.createRuns).toHaveLength(1);

              const bot = await assertSnapshotData(ntb.document);
              expect(bot.m).toBe(ntb.modelKey);
              expect(bot.rc).toBe(1);
              expect(await ntb.loadRunTask(bot.e[0].nk as string)).toBeDefined();

              const second = await ensure({ iv: 5 });
              expect(second.changed).toBe(false);
              expect((await assertSnapshotData(ntb.document)).rc).toBe(1);
            });
          });

          describe('running', () => {
            it('should run processing and cleanup in one send', async () => {
              await ensure({ iv: MS_IN_HOUR });
              const before = await ntb.assertEntry();

              const { sendResult: result } = await ntb.sendRun();
              expect(result.success).toBe(true);

              const entry = await ntb.assertEntry();
              const finishedTask = await ntb.loadRunTask(before.nk as string);

              expect(finishedTask?.d).toBe(true);
              expect(entry.sc).toBe(1);
              expect(entry.d?.['c']).toBe(1);
              expect(entry.lsr).toBe(before.rn);
              expectNotificationTaskBotEntryHistory(entry, [NotificationTaskBotRunOutcome.SUBMITTED]);
              expect(entry.rn).toBe((before.rn as number) + 1);
              expect(await ntb.loadRunTask(entry.nk as string)).toBeDefined();
            });

            it('should cap the history', async () => {
              // each cleanup run waits for the minimum run interval, so every run is re-armed due now first
              for (let i = 0; i < 4; i += 1) {
                await ensure(i === 0 ? { iv: 1 } : undefined, 'now');
                await ntb.sendRun();
              }

              const entry = await ntb.assertEntry();
              expect(entry.sc).toBe(4);
              expect(entry.h).toHaveLength(3); // DEMO_PING historyLimit
            });

            it('should re-delay a run that is not due yet without recording history or an attempt', async () => {
              await ensure({ iv: MS_IN_HOUR });
              await ntb.sendRun(); // first run sends and sets lsat
              await ensure(undefined, 'now'); // a SCHEDULED run due now, so the script's due check decides

              const entry = await ntb.assertEntry();
              await ntb.sendRun({ taskKey: entry.nk as string });

              const after = await ntb.assertEntry();
              const task = await ntb.loadRunTask(entry.nk as string);

              expect(after.h).toHaveLength(1);
              expect(after.rn).toBe(entry.rn);
              expect(task?.d).toBe(false);
              expect(task?.a).toBe(0);
              expect(task?.sat.getTime()).toBeGreaterThan(Date.now() + MS_IN_HOUR / 2);
              expect(after.nat?.getTime()).toBe((entry.lsat as Date).getTime() + MS_IN_HOUR);
            });

            it('should still apply the due check to a MANUAL run but skip it for a FORCED run', async () => {
              await ensure({ iv: MS_IN_HOUR });
              await ntb.sendRun();

              await ntb.schedule({ trigger: NotificationTaskBotRunTrigger.MANUAL });
              await ntb.sendRun();

              const deferred = await ntb.assertEntry();
              expect(deferred.sc).toBe(1); // handed over to a SCHEDULED run
              expect(notificationTaskBotRunTaskData(await ntb.loadRunTask(deferred.nk as string))?.tr).toBe(NotificationTaskBotRunTrigger.SCHEDULED);

              await ntb.schedule({ trigger: NotificationTaskBotRunTrigger.FORCED });
              await ntb.sendRun();

              const entry = await ntb.assertEntry();
              expect(entry.sc).toBe(2);
              expect(entry.h[entry.h.length - 1].tr).toBe(NotificationTaskBotRunTrigger.FORCED);
            });

            it('should fence a stale run so it writes nothing', async () => {
              await ensure({ iv: MS_IN_HOUR });
              const bot = await assertSnapshotData(ntb.document);

              const stale = await createNotificationDocument({
                context: f.demoFirestoreCollections,
                template: notificationTaskBotRunNotificationTaskTemplate({ model: ntb.modelKey, botKey: ntb.documentKey, botId: ntb.documentId, entryId, scriptType, runNumber: 99, trigger: NotificationTaskBotRunTrigger.FORCED, sendAt: new Date() })
              });

              await ntb.sendRun({ taskKey: stale.notificationDocument.key });

              const entry = await ntb.assertEntry();
              expect(entry.sc).toBe(0);
              expect(entry.h).toHaveLength(0);
              expect(entry.rn).toBe(bot.e[0].rn);
              expect((await ntb.loadRunTask(stale.notificationDocument.key))?.d).toBe(true);
            });

            it('should not submit twice when the run already submitted', async () => {
              await ensure({ iv: MS_IN_HOUR });
              const entry = await ntb.assertEntry();

              // simulate a ping step that submitted but crashed before the step completed
              await ntb.applyChanges({ changes: [{ type: 'markSubmitted', entryId, runNumber: entry.rn as number }] });
              await ntb.sendRun();

              const after = await ntb.assertEntry();
              expect(after.sc).toBe(1);
              expect(after.d?.['c']).toBeUndefined();
              expect(after.h[0].o).toBe(NotificationTaskBotRunOutcome.SUBMITTED);
            });

            it('should pause the entry when the script requests it', async () => {
              await ensure({ iv: 1, pa: 1 });
              await ntb.sendRun();

              const entry = await ntb.assertEntry();
              expect(entry.pr).toBe(DEMO_PING_NOTIFICATION_TASK_BOT_PAUSE_REASON_LIMIT);
              expect(entry.rn).toBeFalsy();
            });

            it('should hand a MANUAL run that is not due over to a SCHEDULED run at the due time', async () => {
              await ensure({ iv: MS_IN_HOUR });
              await ntb.sendRun(); // sets lsat

              await ntb.schedule({ trigger: NotificationTaskBotRunTrigger.MANUAL });
              const manual = await ntb.assertEntry();
              await ntb.sendRun();

              const entry = await ntb.assertEntry();
              const due = (entry.lsat as Date).getTime() + MS_IN_HOUR;
              const manualTask = await ntb.loadRunTask(manual.nk as string);
              const handOver = await ntb.loadRunTask(entry.nk as string);

              expect(entry.sc).toBe(1);
              expect(entry.h).toHaveLength(1);
              expect(manualTask?.d).toBe(true);
              expect(entry.rn).toBe((manual.rn as number) + 1);
              expect(notificationTaskBotRunTaskData(handOver)?.tr).toBe(NotificationTaskBotRunTrigger.SCHEDULED);
              expect(notificationTaskBotRunTaskData(handOver)?.x).toBeFalsy();
              expect(notificationTaskBotRunTaskData(handOver)?.sa).toBe(due);
              expect(handOver?.sat.getTime()).toBe(due);
              expect(entry.nat?.getTime()).toBe(due);
            });

            it('should not start an explicit run before its time when woken early', async () => {
              const at = addHours(new Date(), 5);
              await ensure({ iv: MS_IN_HOUR }, false);
              await ntb.schedule({ at, explicit: true });

              const entry = await ntb.assertEntry();
              await ntb.sendRun({ taskKey: entry.nk as string }); // ignores the send-at throttle

              const after = await ntb.assertEntry();
              const task = await ntb.loadRunTask(entry.nk as string);

              expect(after.sc).toBe(0);
              expect(after.h).toHaveLength(0);
              expect(task?.a).toBe(0);
              expect(task?.d).toBe(false);
              expect(task?.sat.getTime()).toBe(at.getTime());
            });

            it('should apply the due check to a not-before run at its time', async () => {
              await ensure({ iv: MS_IN_HOUR });
              await ntb.sendRun(); // sets lsat

              await ntb.schedule({ at: new Date(Date.now() - 1000) });
              await ntb.sendRun();

              const entry = await ntb.assertEntry();
              expect(entry.sc).toBe(1); // delayed by the due check
              expect(entry.nat?.getTime()).toBe((entry.lsat as Date).getTime() + MS_IN_HOUR);

              // the same run made explicit skips the due check
              await ntb.schedule({ at: new Date(Date.now() - 1000), explicit: true });
              await ntb.sendRun();

              expect((await ntb.assertEntry()).sc).toBe(2);
            });

            it('should count a failed step as a failed attempt and retry after the failure delay', async () => {
              await ensure({ iv: MS_IN_HOUR, f: true });
              const entry = await ntb.assertEntry();

              const { sendResult: result } = await ntb.sendRun();
              const task = await ntb.loadRunTask(entry.nk as string);
              const after = await ntb.assertEntry();

              expect(result.success).toBe(false);
              expect(task?.a).toBe(1);
              expect(task?.d).toBe(false);
              expect(task?.sat.getTime()).toBeGreaterThan(Date.now() + 2 * MS_IN_HOUR);
              expect(after.sc).toBe(0);
              expect(after.h).toHaveLength(0);

              // once it runs out of attempts the task is deleted, and repair records the run as lost
              await ntb.exhaustRun();
              expect(await ntb.loadRunTask(entry.nk as string)).toBeUndefined();

              await ntb.repairAt();

              // the default lostRunPolicy ('stop') pauses the entry instead of relaunching it
              const repaired = await ntb.assertEntry();
              expect(repaired.h[0].o).toBe(NotificationTaskBotRunOutcome.LOST);
              expect(repaired.fc).toBe(1);
              expect(repaired.pr).toBe(NOTIFICATION_TASK_BOT_PAUSE_REASON_FAILED);
              expect(repaired.rn).toBeFalsy();
            });

            it("should run a 'run again now' entry once per queue pass", async () => {
              await ensure({ iv: 1 });

              await ntb.sendQueuedNotifications({ maxSendNotificationLoops: 5 });

              const entry = await ntb.assertEntry();
              const task = await ntb.loadRunTask(entry.nk as string);

              expect(entry.sc).toBe(1);
              expect(task?.sat.getTime()).toBeGreaterThanOrEqual(Date.now() + 4 * MS_IN_MINUTE);
            });

            it('should remove the entry when the attached profile was deleted', async () => {
              async function countSentNotifications() {
                const boxDocument = f.demoFirestoreCollections.notificationBoxCollection.documentAccessor().loadDocumentForId(notificationBoxIdForModel(ntb.modelKey));
                const notifications = await f.demoFirestoreCollections.notificationCollectionFactory(boxDocument).queryDocument().getDocs();
                const notificationsData = await Promise.all(notifications.map((x) => getDocumentSnapshotData(x)));
                return notificationsData.filter((x) => x != null && x.st !== NotificationSendType.TASK_NOTIFICATION).length;
              }

              await ensure({ iv: MS_IN_HOUR });
              const entry = await ntb.assertEntry();
              const sentBefore = await countSentNotifications();

              await p.document.accessor.delete();
              await ntb.sendRun();

              const bot = await assertSnapshotData(ntb.document);

              expect(bot.e).toHaveLength(0);
              expect((await ntb.loadRunTask(entry.nk as string))?.d).toBe(true);
              expect(await countSentNotifications()).toBe(sentBefore);
            });
          });

          describe('test helpers', () => {
            it('should finish a run across sends with sendRun({ untilDone })', async () => {
              await ntb.ensure({ scriptType: 'demo_unknown' });

              // processing completes without a processor, then cleanup records the outcome
              const run = await ntb.sendRun({ untilDone: true });
              expect(run.sendResults).toHaveLength(2);
              expect(run.done).toBe(true);
              expect(run.deleted).toBe(false);

              expectNotificationTaskBotEntryHistory(run.entry, [NotificationTaskBotRunOutcome.SKIPPED]);
              expectNotificationTaskBotEntryStatus(run.entry, NotificationTaskBotEntryStatus.IDLE);
            });

            it('should stop sendRun({ schedule, untilDone }) when the run waits', async () => {
              await ensure({ iv: MS_IN_HOUR });
              await ntb.sendRun(); // first run sends and sets lsat
              const before = await ntb.assertEntry();

              // the re-armed run is delayed by the due check
              const run = await ntb.sendRun({ schedule: true, untilDone: true });
              expect(run.sendResults).toHaveLength(1);
              expect(run.done).toBe(false);
              expect(run.taskKey).not.toBe(before.nk);
              expect(run.entry?.sc).toBe(before.sc);
              expectNotificationTaskBotEntryStatus(run.entry, NotificationTaskBotEntryStatus.SCHEDULED);
            });

            it('should throw from sendRun() when the entry has no live run', async () => {
              await ensure({ iv: MS_IN_HOUR }, false);
              await expect(ntb.sendRun()).rejects.toThrow();
            });

            it('should stall the live run with stallRun()', async () => {
              await ensure({ iv: MS_IN_HOUR });

              const result = await ntb.stallRun();
              expect(result.repairResult.entriesStalled).toBe(1);
              expect(result.entry.stl).toBeDefined();
              expect((await ntb.loadRunTask(result.taskKey))?.a).toBe(1);
              expectNotificationTaskBotEntryStatus(result.entry, NotificationTaskBotEntryStatus.STALLED);
            });

            it("should stall the live run with stallRun({ mode: 'unpicked' })", async () => {
              await ensure({ iv: MS_IN_HOUR });

              const result = await ntb.stallRun({ mode: 'unpicked' });
              expect(result.repairResult.entriesStalled).toBe(1);
              expect((await ntb.loadRunTask(result.taskKey))?.a).toBe(0);
              await ntb.expectStatus(NotificationTaskBotEntryStatus.STALLED);
            });
          });

          describe('resume', () => {
            it('should restart the ping count after a resume from the limit', async () => {
              await ensure({ iv: 1, pa: 2 }, 'now');
              await ntb.sendRun();
              await ensure(undefined, 'now');
              await ntb.sendRun();

              const limited = await ntb.assertEntry();
              expect(limited.pr).toBe(DEMO_PING_NOTIFICATION_TASK_BOT_PAUSE_REASON_LIMIT);
              expect(limited.d?.['c']).toBe(2);

              await ntb.applyChanges({ changes: [{ type: 'pause', entryId, pause: false }] });
              expect((await ntb.assertEntry()).rpr).toBe(DEMO_PING_NOTIFICATION_TASK_BOT_PAUSE_REASON_LIMIT);

              await ntb.sendRun();

              const entry = await ntb.assertEntry();
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
              await ntb.applyChanges({ changes: [{ type: 'pause', entryId, pause: { reason: NOTIFICATION_TASK_BOT_PAUSE_REASON_MANUAL, until: new Date() } }] });

              const paused = await ntb.assertEntry();
              expectNotificationTaskBotEntryStatus(paused, NotificationTaskBotEntryStatus.PAUSED);
              expect(paused.nk).toBeTruthy();
              expect(paused.nat?.getTime()).toBe(paused.pu?.getTime());

              await ntb.sendRun();

              const entry = await ntb.assertEntry();
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
              await ntb.applyChanges({ changes: [{ type: 'pause', entryId, pause: { reason: NOTIFICATION_TASK_BOT_PAUSE_REASON_MANUAL, until } }] });

              const paused = await ntb.assertEntry();
              await ntb.sendRun({ taskKey: paused.nk as string });

              const entry = await ntb.assertEntry();
              const task = await ntb.loadRunTask(paused.nk as string);

              expectNotificationTaskBotEntryStatus(entry, NotificationTaskBotEntryStatus.PAUSED);
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

              const seeded = await ntb.assertEntry();
              expect(seeded.sc).toBe(5);
              expect(seeded.h).toHaveLength(3); // the demo_ping history limit
              expect(seeded.h.map((x) => x.rn)).toEqual([0, 0, 0]);
              expect(seeded.h.map((x) => x.d?.['n'])).toEqual([3, 4, 5]);
              expect((await assertSnapshotData(ntb.document)).rc).toBe(1);
              expect(seeded.rn).toBe(1);

              await ntb.sendRun();

              const delayed = await ntb.assertEntry();
              expect(delayed.sc).toBe(5);
              expect(delayed.nat?.getTime()).toBe(seededLsat.getTime() + MS_IN_HOUR);

              await ntb.schedule({ trigger: NotificationTaskBotRunTrigger.FORCED });
              await ntb.sendRun();

              const entry = await ntb.assertEntry();
              const last = entry.h[entry.h.length - 1];

              expect(entry.sc).toBe(6);
              expect(last.o).toBe(NotificationTaskBotRunOutcome.SUBMITTED);
              expect(last.tr).toBe(NotificationTaskBotRunTrigger.FORCED);
            });

            it('should seed a paused entry with no run', async () => {
              await ensure({ iv: MS_IN_HOUR }, undefined, { pause: { reason: 'no_progress' } });

              const entry = await ntb.assertEntry();
              expectNotificationTaskBotEntryStatus(entry, NotificationTaskBotEntryStatus.PAUSED);
              expect(entry.pr).toBe('no_progress');
              expect(entry.rn).toBeFalsy();
            });
          });

          describe('scheduling', () => {
            it('should re-arm an idle entry with ensure ifIdle', async () => {
              await ensure({ iv: MS_IN_HOUR }, false);
              expect((await ntb.assertEntry()).rn).toBeFalsy();

              const result = await ensure(undefined, 'ifIdle');
              expect(result.createRuns).toHaveLength(1);
              expect((await ntb.assertEntry()).rn).toBe(1);
            });

            it('should delete the pending run when the entry is disabled or removed', async () => {
              await ensure({ iv: MS_IN_HOUR });
              const first = await ntb.assertEntry();

              await ntb.applyChanges({ changes: [{ type: 'state', entryId, state: NotificationTaskBotEntryState.DISABLED }] });
              expect(await ntb.loadRunTask(first.nk as string)).toBeUndefined();

              await ntb.applyChanges({ changes: [{ type: 'state', entryId, state: NotificationTaskBotEntryState.ENABLED }] });
              const second = await ntb.assertEntry();
              expect(await ntb.loadRunTask(second.nk as string)).toBeDefined();

              await removeNotificationTaskBotEntryFactory(f.serverActionsContext)({ model: ntb.modelKey, entryId });
              expect(await ntb.loadRunTask(second.nk as string)).toBeUndefined();
              expect((await assertSnapshotData(ntb.document)).e).toHaveLength(0);
            });

            it('should not clobber other entries', async () => {
              await ensure({ iv: MS_IN_HOUR });
              await ntb.ensure({ entryId: 'other', scriptType, schedule: false, data: { iv: 5 } });
              await ntb.sendRun();

              const bot = await assertSnapshotData(ntb.document);
              expect(bot.e).toHaveLength(2);
              expect(notificationTaskBotEntry(bot, 'other')?.d).toEqual({ iv: 5 });
              expect(notificationTaskBotEntry(bot, entryId)?.sc).toBe(1);
            });
          });

          describe('owner opt-out', () => {
            async function optOut(value: boolean) {
              return ntb.applyChanges({ changes: [{ type: 'optOut', group: DEMO_PING_NOTIFICATION_TASK_BOT_GROUP.key, optOut: value }] });
            }

            it('should delete the pending run so it never sends', async () => {
              await ensure({ iv: MS_IN_HOUR });
              const before = await ntb.assertEntry();

              const result = await optOut(true);
              const entry = await ntb.assertEntry();

              expect(result.deleteTaskKeys).toEqual([before.nk]);
              expect(await ntb.loadRunTask(before.nk as string)).toBeUndefined();
              expect(entry.oat).toBeDefined();
              expect(entry.rn).toBeFalsy();
              expect(entry.sc).toBe(0);
            });

            it('should fence a recreated run of an opted-out entry so it writes nothing', async () => {
              await ensure({ iv: MS_IN_HOUR });
              const before = await ntb.assertEntry();
              await optOut(true);

              const recreated = await createNotificationDocument({
                context: f.demoFirestoreCollections,
                template: notificationTaskBotRunNotificationTaskTemplate({ model: ntb.modelKey, botKey: ntb.documentKey, botId: ntb.documentId, entryId, scriptType, runNumber: before.rn as number, trigger: NotificationTaskBotRunTrigger.FORCED, sendAt: new Date() })
              });

              await ntb.sendRun({ taskKey: recreated.notificationDocument.key });

              const entry = await ntb.assertEntry();
              expect(entry.sc).toBe(0);
              expect(entry.h).toHaveLength(0);
              expect(entry.rn).toBeFalsy();
              expect(entry.oat).toBeDefined();
              expect((await ntb.loadRunTask(recreated.notificationDocument.key))?.d).toBe(true);
            });

            it('should be ignored by repair', async () => {
              await ensure({ iv: MS_IN_HOUR });
              await optOut(true);

              const result = await ntb.repairAt();
              expect(result.entriesRepaired).toBe(0);
              expect(result.entriesStalled).toBe(0);

              const entry = await ntb.assertEntry();
              expect(entry.rn).toBeFalsy();
              expect(entry.h).toHaveLength(0);
            });

            it('should schedule a new run when opted back in', async () => {
              await ensure({ iv: MS_IN_HOUR });
              const before = await ntb.assertEntry();
              await optOut(true);

              const result = await optOut(false);
              const entry = await ntb.assertEntry();

              expect(result.createRuns).toHaveLength(1);
              expect(entry.oat).toBeFalsy();
              expect(entry.rn).toBeGreaterThan(before.rn as number);
              expect(await ntb.loadRunTask(entry.nk as string)).toBeDefined();
            });
          });

          describe('stalled', () => {
            it('should mark a failing run stalled, keep its fence, and clear it when the run completes', async () => {
              await ensure({ iv: MS_IN_HOUR, f: true });
              const entry = await ntb.assertEntry();
              await ntb.sendRun(); // the ping step fails, so the task retries in 3h

              const result = await ntb.repairAt();
              expect(result.entriesSynced).toBe(1);
              expect(result.entriesStalled).toBe(1);
              expect(result.entriesRepaired).toBe(0);

              const stalled = await ntb.assertEntry();
              const task = await ntb.loadRunTask(entry.nk as string);
              expect(stalled.stl).toBeDefined();
              expectNotificationTaskBotEntryStatus(stalled, NotificationTaskBotEntryStatus.STALLED);
              expect(stalled.rn).toBe(entry.rn);
              expect(stalled.nat?.getTime()).toBe(task?.sat.getTime());
              expect((await assertSnapshotData(ntb.document)).stl?.getTime()).toBe(stalled.stl?.getTime());

              // the fence holds
              const ensured = await ensure();
              expect(ensured.createRuns).toHaveLength(0);
              expect((await ntb.assertEntry()).stl?.getTime()).toBe(stalled.stl?.getTime());

              // a later sweep keeps the first stamp
              const later = await ntb.repairAt({ now: addHours(new Date(), 5) });
              expect(later.entriesStalled).toBe(0);
              expect((await ntb.assertEntry()).stl?.getTime()).toBe(stalled.stl?.getTime());

              // recover
              await ntb.applyChanges({ changes: [{ type: 'data', entryId, data: { f: null } }] });
              await ntb.sendRun();

              const recovered = await ntb.assertEntry();
              expect(recovered.stl).toBeFalsy();
              expect((await assertSnapshotData(ntb.document)).stl).toBeFalsy();
              expect(recovered.h[0].o).toBe(NotificationTaskBotRunOutcome.SUBMITTED);
              expect(recovered.fc).toBe(0);
              expectNotificationTaskBotEntryStatus(recovered, NotificationTaskBotEntryStatus.SCHEDULED);
            });

            it('should mark a run that nothing picks up stalled, and find its bot with notificationTaskBotsStalledQuery()', async () => {
              await ensure({ iv: MS_IN_HOUR });

              const result = await ntb.repairAt();
              expect(result.entriesStalled).toBe(1);
              expect(await stalledBotKeys()).toContain(ntb.documentKey);
            });

            it('should supersede a stalled run with update:run', async () => {
              await ensure({ iv: MS_IN_HOUR });
              await ntb.repairAt();
              const stalled = await ntb.assertEntry();
              expect(stalled.stl).toBeDefined();

              const result = await runEntry({ runImmediately: false });
              const entry = await ntb.assertEntry();

              expect(await ntb.loadRunTask(stalled.nk as string)).toBeUndefined();
              expect(entry.rn).toBeGreaterThan(stalled.rn as number);
              expect(entry.stl).toBeFalsy();
              expect((await assertSnapshotData(ntb.document)).stl).toBeFalsy();
              expectNotificationTaskBotEntryStatus(entry, NotificationTaskBotEntryStatus.SCHEDULED);
              expect(result.taskKey).toBe(entry.nk);
              expect(await stalledBotKeys()).not.toContain(ntb.documentKey);
            });
          });

          describe('repair', () => {
            it("should record a lost run and pause the entry by default ('stop')", async () => {
              await ensure({ iv: MS_IN_HOUR });
              await loseLiveRun();

              const result = await ntb.repairAt();
              expect(result.entriesRepaired).toBe(1);

              const after = await ntb.assertEntry();
              expect(after.h[0].o).toBe(NotificationTaskBotRunOutcome.LOST);
              expect(after.fc).toBe(1);
              expect(after.pr).toBe(NOTIFICATION_TASK_BOT_PAUSE_REASON_FAILED);
              expect(after.rn).toBeFalsy();
              expectNotificationTaskBotEntryStatus(after, NotificationTaskBotEntryStatus.PAUSED);
              expect((await assertSnapshotData(ntb.document)).nat).toBeFalsy();
            });

            it("should leave the entry idle for the app to re-arm ('idle')", async () => {
              await ensure({ iv: MS_IN_HOUR });
              await loseLiveRun();

              await repairWithScriptConfig({ lostRunPolicy: 'idle' })({ now: addHours(new Date(), 2) });

              const after = await ntb.assertEntry();
              expect(after.h[0].o).toBe(NotificationTaskBotRunOutcome.LOST);
              expect(after.fc).toBe(1);
              expect(after.pat).toBeFalsy();
              expect(after.rn).toBeFalsy();
              expectNotificationTaskBotEntryStatus(after, NotificationTaskBotEntryStatus.IDLE);

              const rearmed = await ensure();
              expect(rearmed.createRuns).toHaveLength(1);
            });

            it("should relaunch until the failure budget is spent ('retry')", async () => {
              const repair = repairWithScriptConfig({ lostRunPolicy: 'retry', maxConsecutiveFailures: 2 });
              await ensure({ iv: MS_IN_HOUR });

              const first = await loseLiveRun();
              await repair({ now: addHours(new Date(), 2) });

              const relaunched = await ntb.assertEntry();
              expect(relaunched.h[0].o).toBe(NotificationTaskBotRunOutcome.LOST);
              expect(relaunched.fc).toBe(1);
              expect(relaunched.rn).toBeGreaterThan(first.rn as number);
              expect(await ntb.loadRunTask(relaunched.nk as string)).toBeDefined();

              // the retry run was issued at the first sweep's now, so the second sweep runs later
              await loseLiveRun();
              await repair({ now: addHours(new Date(), 4) });

              const stopped = await ntb.assertEntry();
              expect(stopped.h.filter((x) => x.o === NotificationTaskBotRunOutcome.LOST)).toHaveLength(2);
              expect(stopped.fc).toBe(2);
              expect(stopped.pr).toBe(NOTIFICATION_TASK_BOT_PAUSE_REASON_FAILED);
              expect(stopped.rn).toBeFalsy();
            });

            it("should resume a 'failed' pause with a FORCED update:run", async () => {
              await ensure({ iv: MS_IN_HOUR });
              await loseLiveRun();
              await ntb.repairAt();
              expect((await ntb.assertEntry()).pr).toBe(NOTIFICATION_TASK_BOT_PAUSE_REASON_FAILED);

              const result = await runEntry({ trigger: NotificationTaskBotRunTrigger.FORCED, runImmediately: false });
              const resumed = await ntb.assertEntry();

              expect(resumed.pat).toBeFalsy();
              expect(resumed.pr).toBeFalsy();
              expect(resumed.rpr).toBe(NOTIFICATION_TASK_BOT_PAUSE_REASON_FAILED);
              expect(resumed.fc).toBe(0);
              expect(notificationTaskBotRunTaskData(await ntb.loadRunTask(result.taskKey))?.tr).toBe(NotificationTaskBotRunTrigger.FORCED);

              await ntb.sendRun();

              const ran = await ntb.assertEntry();
              const last = ran.h[ran.h.length - 1];
              expect(last.o).toBe(NotificationTaskBotRunOutcome.SUBMITTED);
              expect(last.tr).toBe(NotificationTaskBotRunTrigger.FORCED);
              expect(ran.rpr).toBeFalsy();
            });

            it('should only sync nat for a pending run that waits on purpose', async () => {
              await ensure({ iv: MS_IN_HOUR });
              const entry = await ntb.assertEntry();
              await ntb.loadRunTaskDocument(entry.nk as string).update({ sat: addHours(new Date(), 3) });

              const result = await ntb.repairAt();
              expect(result.entriesSynced).toBe(1);
              expect(result.entriesStalled).toBe(0);

              const after = await ntb.assertEntry();
              const task = await ntb.loadRunTask(entry.nk as string);
              expect(after.rn).toBe(entry.rn);
              expect(after.nat?.getTime()).toBe(task?.sat.getTime());
              expect(after.stl).toBeFalsy();
              expect(after.h).toHaveLength(0);
            });
          });
        });
      });
    });
  });
});
