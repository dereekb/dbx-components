import { addHours } from 'date-fns';
import { demoApiFunctionContextFactory, demoAuthorizedUserContext, demoNotificationTaskBotContext, demoProfileContext } from '../../../test/fixture';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { createNotificationDocument, getDocumentSnapshotData, type NotificationTaskBotEntryData, notificationTaskBotEntry, NotificationTaskBotEntryState, NotificationTaskBotRunOutcome, notificationTaskBotRunNotificationTaskTemplate, NotificationTaskBotRunTrigger, type NotificationTaskKey } from '@dereekb/firebase';
import { applyNotificationTaskBotChangesFactory, ensureNotificationTaskBotEntryFactory, removeNotificationTaskBotEntryFactory, scheduleNotificationTaskBotEntryFactory } from '@dereekb/firebase-server/model';
import { DEMO_PING_NOTIFICATION_TASK_BOT_ENTRY_ID, DEMO_PING_NOTIFICATION_TASK_BOT_PAUSE_REASON_LIMIT, DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE } from 'demo-firebase';
import { MS_IN_HOUR } from '@dereekb/util';

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

          async function ensure(data?: NotificationTaskBotEntryData, schedule?: 'ifIdle' | 'now' | Date | false) {
            return ensureNotificationTaskBotEntryFactory(f.serverActionsContext)({ model: model(), entryId, scriptType, data, schedule });
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
              await ensure({ iv: 1 });

              for (let i = 0; i < 4; i += 1) {
                await sendLiveRun();
              }

              const entry = await loadEntry();
              expect(entry.sc).toBe(4);
              expect(entry.h).toHaveLength(3); // DEMO_PING historyLimit
            });

            it('should re-delay a run that is not due yet without recording history or an attempt', async () => {
              await ensure({ iv: MS_IN_HOUR });
              await sendLiveRun(); // first run sends and sets lsat

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
              expect((await loadEntry()).sc).toBe(1); // delayed

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
