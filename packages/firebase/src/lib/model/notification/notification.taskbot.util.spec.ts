import { describe, expect, it } from 'vitest';
import { type NotificationTaskBot, NotificationTaskBotEntryState, NotificationTaskBotEntryStatus, NotificationTaskBotRunOutcome, NotificationTaskBotRunTrigger } from './notification.taskbot';
import { appendNotificationTaskBotEntryHistoryItem, applyNotificationTaskBotChange, applyNotificationTaskBotChanges, type NotificationTaskBotChange, mergeNotificationTaskBotEntryData, notificationTaskBotEntry, notificationTaskBotEntryStatus, notificationTaskBotNextRunAt } from './notification.taskbot.util';

const model = 'profile/abc';
const now = new Date('2026-01-02T00:00:00.000Z');
const later = new Date('2026-01-03T00:00:00.000Z');

function apply(bot: NotificationTaskBot | undefined, change: NotificationTaskBotChange, at = now) {
  return applyNotificationTaskBotChange({ bot, model, change, now: at });
}

function ensured(schedule: 'ifIdle' | 'now' | Date | false = 'ifIdle', data?: object) {
  const result = apply(undefined, { type: 'ensure', entryId: 'ping', scriptType: 'demo_ping', data, schedule });
  return result.bot as NotificationTaskBot;
}

describe('applyNotificationTaskBotChange()', () => {
  describe('ensure', () => {
    it('should create the bot and the entry and issue the first run', () => {
      const result = apply(undefined, { type: 'ensure', entryId: 'ping', scriptType: 'demo_ping', data: { c: 0 } });
      const bot = result.bot as NotificationTaskBot;

      expect(result.changed).toBe(true);
      expect(bot.m).toBe(model);
      expect(bot.rc).toBe(1);
      expect(bot.nat).toEqual(now);
      expect(bot.e[0].rn).toBe(1);
      expect(bot.e[0].nk).toBe('nb/profile_abc/nbn/profile_abc_ping_r1');
      expect(bot.e[0].d).toEqual({ c: 0 });
      expect(result.createRuns).toHaveLength(1);
      expect(result.createRuns[0]).toMatchObject({ entryId: 'ping', runNumber: 1, trigger: NotificationTaskBotRunTrigger.SCHEDULED, explicit: false, sendAt: now });
    });

    it('should be a no-op when repeated on an entry with a live run', () => {
      const result = apply(ensured(), { type: 'ensure', entryId: 'ping', scriptType: 'demo_ping', data: { c: 5 } });

      expect(result.changed).toBe(false);
      expect(result.createRuns).toHaveLength(0);
      expect(result.entry?.d).toBeUndefined();
    });

    it('should supersede the live run when scheduling now', () => {
      const result = apply(ensured(), { type: 'ensure', entryId: 'ping', scriptType: 'demo_ping', schedule: 'now' });

      expect(result.bot?.rc).toBe(2);
      expect(result.entry?.rn).toBe(2);
      expect(result.deleteTaskKeys).toEqual(['nb/profile_abc/nbn/profile_abc_ping_r1']);
    });

    it('should schedule an explicit run at a date', () => {
      const result = apply(undefined, { type: 'ensure', entryId: 'ping', scriptType: 'demo_ping', schedule: later });
      expect(result.createRuns[0]).toMatchObject({ sendAt: later, explicit: true });
    });

    it('should not schedule when schedule is false', () => {
      const bot = ensured(false);
      expect(bot.e[0].rn).toBeUndefined();
      expect(bot.nat).toBeNull();
    });

    it('should throw on an invalid entry id', () => {
      expect(() => apply(undefined, { type: 'ensure', entryId: 'bad_id', scriptType: 'demo_ping' })).toThrow();
    });
  });

  it('should report an unknown entry', () => {
    const result = apply(ensured(), { type: 'cancel', entryId: 'missing' });
    expect(result.unknownEntry).toBe(true);
    expect(result.changed).toBe(false);
  });

  describe('schedule', () => {
    it('should supersede the live run with a MANUAL run', () => {
      const result = apply(ensured(), { type: 'schedule', entryId: 'ping', trigger: NotificationTaskBotRunTrigger.MANUAL });

      expect(result.createRuns[0]).toMatchObject({ runNumber: 2, trigger: NotificationTaskBotRunTrigger.MANUAL });
      expect(result.deleteTaskKeys).toHaveLength(1);
    });

    it('should not schedule when ifIdle is set and the entry has a live run', () => {
      const result = apply(ensured(), { type: 'schedule', entryId: 'ping', ifIdle: true });
      expect(result.createRuns).toHaveLength(0);
    });

    it('should not schedule a paused entry', () => {
      const paused = apply(ensured(), { type: 'pause', entryId: 'ping', pause: { reason: 'manual' } }).bot as NotificationTaskBot;
      const result = apply(paused, { type: 'schedule', entryId: 'ping' });
      expect(result.createRuns).toHaveLength(0);
    });
  });

  it('should cancel the live run without bumping the run counter', () => {
    const result = apply(ensured(), { type: 'cancel', entryId: 'ping' });

    expect(result.bot?.rc).toBe(1);
    expect(result.entry?.rn).toBeNull();
    expect(result.bot?.nat).toBeNull();
    expect(result.deleteTaskKeys).toHaveLength(1);
    expect(notificationTaskBotEntryStatus(result.entry!)).toBe(NotificationTaskBotEntryStatus.IDLE);
  });

  describe('state', () => {
    it('should cancel the live run when disabling', () => {
      const result = apply(ensured(), { type: 'state', entryId: 'ping', state: NotificationTaskBotEntryState.DISABLED });

      expect(result.deleteTaskKeys).toHaveLength(1);
      expect(notificationTaskBotEntryStatus(result.entry!)).toBe(NotificationTaskBotEntryStatus.DISABLED);
    });

    it('should reschedule when enabling', () => {
      const disabled = apply(ensured(), { type: 'state', entryId: 'ping', state: NotificationTaskBotEntryState.DISABLED }).bot as NotificationTaskBot;
      const result = apply(disabled, { type: 'state', entryId: 'ping', state: NotificationTaskBotEntryState.ENABLED });

      expect(result.createRuns[0].runNumber).toBe(2);
      expect(notificationTaskBotEntryStatus(result.entry!)).toBe(NotificationTaskBotEntryStatus.SCHEDULED);
    });
  });

  describe('pause', () => {
    it('should pause and cancel the live run, then resume and reschedule', () => {
      const paused = apply(ensured(), { type: 'pause', entryId: 'ping', pause: { reason: 'manual' } });

      expect(paused.entry?.pat).toEqual(now);
      expect(paused.entry?.pr).toBe('manual');
      expect(paused.deleteTaskKeys).toHaveLength(1);
      expect(notificationTaskBotEntryStatus(paused.entry!)).toBe(NotificationTaskBotEntryStatus.PAUSED);

      const resumed = apply(paused.bot as NotificationTaskBot, { type: 'pause', entryId: 'ping', pause: false });

      expect(resumed.entry?.pat).toBeNull();
      expect(resumed.entry?.fc).toBe(0);
      expect(resumed.createRuns[0].runNumber).toBe(2);
    });
  });

  it('should set and clear lsat', () => {
    const set = apply(ensured(), { type: 'lsat', entryId: 'ping', lsat: later });
    expect(set.entry?.lsat).toEqual(later);

    const cleared = apply(set.bot as NotificationTaskBot, { type: 'lsat', entryId: 'ping', lsat: null });
    expect(cleared.entry?.lsat).toBeNull();
  });

  it('should merge data, deleting keys set to null', () => {
    const result = apply(ensured('ifIdle', { a: 1, b: 2 }), { type: 'data', entryId: 'ping', data: { b: null, c: 3, d: undefined } });
    expect(result.entry?.d).toEqual({ a: 1, c: 3 });
  });

  it('should remove the entry and delete its live run', () => {
    const result = apply(ensured(), { type: 'remove', entryId: 'ping' });

    expect(result.bot?.e).toHaveLength(0);
    expect(result.bot?.rc).toBe(1);
    expect(result.deleteTaskKeys).toHaveLength(1);
    expect(result.entry).toBeUndefined();
  });

  describe('completeRun', () => {
    it('should record history and schedule the next run with the next run number', () => {
      const result = apply(ensured(), { type: 'completeRun', entryId: 'ping', runNumber: 1, trigger: NotificationTaskBotRunTrigger.SCHEDULED, outcome: NotificationTaskBotRunOutcome.SUBMITTED, history: { d: { n: 1 } }, updateData: { c: 1 }, nextRunAt: later });
      const entry = result.entry!;

      expect(entry.lat).toEqual(now);
      expect(entry.fc).toBe(0);
      expect(entry.d).toEqual({ c: 1 });
      expect(entry.h).toEqual([{ at: now, rn: 1, tr: NotificationTaskBotRunTrigger.SCHEDULED, o: NotificationTaskBotRunOutcome.SUBMITTED, d: { n: 1 } }]);
      expect(entry.rn).toBe(2);
      expect(result.createRuns[0]).toMatchObject({ runNumber: 2, sendAt: later, explicit: false });
      expect(result.deleteTaskKeys).toHaveLength(0); // the finished run is marked done by the handler
      expect(result.bot?.nat).toEqual(later);
    });

    it('should go idle by default', () => {
      const result = apply(ensured(), { type: 'completeRun', entryId: 'ping', runNumber: 1, trigger: NotificationTaskBotRunTrigger.SCHEDULED });

      expect(result.entry?.rn).toBeNull();
      expect(result.entry?.h[0].o).toBe(NotificationTaskBotRunOutcome.COMPLETED);
      expect(result.bot?.nat).toBeNull();
      expect(result.createRuns).toHaveLength(0);
    });

    it('should be fenced off when the run number does not match', () => {
      const result = apply(ensured(), { type: 'completeRun', entryId: 'ping', runNumber: 7, trigger: NotificationTaskBotRunTrigger.SCHEDULED, nextRunAt: later });

      expect(result.fenced).toBe(true);
      expect(result.changed).toBe(false);
      expect(result.createRuns).toHaveLength(0);
    });

    it('should apply the minimum run interval', () => {
      const result = apply(ensured(), { type: 'completeRun', entryId: 'ping', runNumber: 1, trigger: NotificationTaskBotRunTrigger.SCHEDULED, nextRunAtExplicit: now, minimumRunInterval: 60000 });
      expect(result.createRuns[0]).toMatchObject({ sendAt: new Date(now.getTime() + 60000), explicit: true });
    });

    it('should pause instead of scheduling when requested', () => {
      const result = apply(ensured(), { type: 'completeRun', entryId: 'ping', runNumber: 1, trigger: NotificationTaskBotRunTrigger.SCHEDULED, nextRunAt: later, pause: { reason: 'no_progress' } });

      expect(result.entry?.pr).toBe('no_progress');
      expect(result.createRuns).toHaveLength(0);
    });

    it('should disable when requested', () => {
      const result = apply(ensured(), { type: 'completeRun', entryId: 'ping', runNumber: 1, trigger: NotificationTaskBotRunTrigger.SCHEDULED, disable: true });
      expect(result.entry?.s).toBe(NotificationTaskBotEntryState.DISABLED);
    });

    it('should skip history when history is false', () => {
      const result = apply(ensured(), { type: 'completeRun', entryId: 'ping', runNumber: 1, trigger: NotificationTaskBotRunTrigger.SCHEDULED, history: false });
      expect(result.entry?.h).toHaveLength(0);
    });

    it('should cap the history to the limit and support replaceLast', () => {
      let bot = ensured();

      for (let i = 0; i < 5; i += 1) {
        const rn = bot.e[0].rn as number;
        bot = apply(bot, { type: 'completeRun', entryId: 'ping', runNumber: rn, trigger: NotificationTaskBotRunTrigger.SCHEDULED, nextRunAt: later, historyLimit: 3 }).bot as NotificationTaskBot;
      }

      expect(bot.e[0].h.map((x) => x.rn)).toEqual([3, 4, 5]);

      const replaced = apply(bot, { type: 'completeRun', entryId: 'ping', runNumber: 6, trigger: NotificationTaskBotRunTrigger.SCHEDULED, history: { replaceLast: true }, historyLimit: 3 }).bot as NotificationTaskBot;
      expect(replaced.e[0].h.map((x) => x.rn)).toEqual([3, 4, 6]);
    });
  });

  describe('markSubmitted', () => {
    it('should mark the run submitted once', () => {
      const first = apply(ensured(), { type: 'markSubmitted', entryId: 'ping', runNumber: 1 });

      expect(first.entry).toMatchObject({ lsat: now, lsr: 1, sc: 1 });

      const second = apply(first.bot as NotificationTaskBot, { type: 'markSubmitted', entryId: 'ping', runNumber: 1 }, later);
      expect(second.changed).toBe(false);
      expect(second.entry?.sc).toBe(1);
    });

    it('should be fenced off for a stale run', () => {
      expect(apply(ensured(), { type: 'markSubmitted', entryId: 'ping', runNumber: 9 }).fenced).toBe(true);
    });
  });

  it('should sync nat for the live run only', () => {
    const synced = apply(ensured(), { type: 'syncNat', entryId: 'ping', runNumber: 1, nat: later });

    expect(synced.entry?.nat).toEqual(later);
    expect(synced.bot?.nat).toEqual(later);
    expect(apply(ensured(), { type: 'syncNat', entryId: 'ping', runNumber: 2, nat: later }).fenced).toBe(true);
  });

  describe('repair', () => {
    it('should only sync nat when the task is still pending', () => {
      const result = apply(ensured(), { type: 'repair', entryId: 'ping', runNumber: 1, pendingTaskSendAt: later });

      expect(result.entry?.nat).toEqual(later);
      expect(result.entry?.rn).toBe(1);
      expect(result.createRuns).toHaveLength(0);
    });

    it('should record a lost run and reschedule', () => {
      const result = apply(ensured(), { type: 'repair', entryId: 'ping', runNumber: 1 });

      expect(result.entry?.h[0].o).toBe(NotificationTaskBotRunOutcome.LOST);
      expect(result.entry?.fc).toBe(1);
      expect(result.createRuns[0].runNumber).toBe(2);
      expect(result.deleteTaskKeys).toHaveLength(0);
    });

    it('should pause with the failed reason once the failure budget is spent', () => {
      const result = apply(ensured(), { type: 'repair', entryId: 'ping', runNumber: 1, maxConsecutiveFailures: 1 });

      expect(result.entry?.pr).toBe('failed');
      expect(result.createRuns).toHaveLength(0);
    });
  });

  it('should keep the run counter monotonic across remove and re-ensure', () => {
    const removed = apply(ensured(), { type: 'remove', entryId: 'ping' }).bot as NotificationTaskBot;
    const result = apply(removed, { type: 'ensure', entryId: 'ping', scriptType: 'demo_ping' });

    expect(result.entry?.rn).toBe(2);
    expect(result.entry?.h).toHaveLength(0);
  });

  it('should not clobber other entries', () => {
    const bot = apply(ensured(), { type: 'ensure', entryId: 'other', scriptType: 'demo_ping', schedule: later }).bot as NotificationTaskBot;
    const result = apply(bot, { type: 'pause', entryId: 'ping', pause: { reason: 'manual' } });

    expect(notificationTaskBotEntry(result.bot, 'other')?.rn).toBe(2);
    expect(result.bot?.nat).toEqual(later);
  });
});

describe('applyNotificationTaskBotChanges()', () => {
  it('should drop runs that were created and superseded within the same batch', () => {
    const result = applyNotificationTaskBotChanges({
      bot: undefined,
      model,
      now,
      changes: [
        { type: 'ensure', entryId: 'ping', scriptType: 'demo_ping' },
        { type: 'schedule', entryId: 'ping', trigger: NotificationTaskBotRunTrigger.FORCED }
      ]
    });

    expect(result.createRuns).toHaveLength(1);
    expect(result.createRuns[0]).toMatchObject({ runNumber: 2, trigger: NotificationTaskBotRunTrigger.FORCED });
    expect(result.deleteTaskKeys).toHaveLength(0);
  });
});

describe('utilities', () => {
  it('notificationTaskBotNextRunAt() should return the soonest nat among live runs', () => {
    expect(
      notificationTaskBotNextRunAt([
        { rn: 1, nat: later },
        { rn: 2, nat: now },
        { rn: null, nat: new Date(0) }
      ])
    ).toEqual(now);
  });

  it('mergeNotificationTaskBotEntryData() should return undefined when no keys remain', () => {
    expect(mergeNotificationTaskBotEntryData({ a: 1 }, { a: null })).toBeUndefined();
  });

  it('appendNotificationTaskBotEntryHistoryItem() should keep the newest items', () => {
    const item = (rn: number) => ({ at: now, rn, tr: NotificationTaskBotRunTrigger.SCHEDULED, o: NotificationTaskBotRunOutcome.COMPLETED });
    expect(appendNotificationTaskBotEntryHistoryItem([item(1), item(2)], item(3), 2).map((x) => x.rn)).toEqual([2, 3]);
  });
});
