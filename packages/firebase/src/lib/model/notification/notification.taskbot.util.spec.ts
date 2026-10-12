import { describe, expect, it } from 'vitest';
import { type Maybe } from '@dereekb/util';
import { type NotificationTaskBot, type NotificationTaskBotEmbeddedScriptEntry, NotificationTaskBotEntryState, NotificationTaskBotEntryStatus, NotificationTaskBotRunOutcome, NotificationTaskBotRunTrigger } from './notification.taskbot';
import { DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_MINIMUM_RUN_INTERVAL } from './notification.taskbot.script';
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

    it('should schedule a not-before run at a date by default', () => {
      const result = apply(undefined, { type: 'ensure', entryId: 'ping', scriptType: 'demo_ping', schedule: later });
      expect(result.createRuns[0]).toMatchObject({ sendAt: later, explicit: false });
    });

    it('should schedule an explicit run at a date', () => {
      const result = apply(undefined, { type: 'ensure', entryId: 'ping', scriptType: 'demo_ping', schedule: later, explicit: true });
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

    describe('seed', () => {
      const seedLsat = new Date('2026-01-01T12:00:00.000Z');
      const seedLat = new Date('2026-01-01T12:01:00.000Z');
      const historyItem = (hour: number) => ({ at: new Date(`2026-01-01T0${hour}:00:00.000Z`), tr: NotificationTaskBotRunTrigger.SCHEDULED, o: NotificationTaskBotRunOutcome.SUBMITTED, d: { n: hour } });

      it('should create the entry with the seeded lsat, lat and sc', () => {
        const result = apply(undefined, { type: 'ensure', entryId: 'ping', scriptType: 'demo_ping', seed: { lsat: seedLsat, lat: seedLat, sc: 5 } });
        const entry = result.entry!;

        expect(entry.lsat).toEqual(seedLsat);
        expect(entry.lat).toEqual(seedLat);
        expect(entry.sc).toBe(5);
        expect(entry.lsr).toBeUndefined();
      });

      it('should sort the seeded history, cap it to the limit and stamp it with run number 0', () => {
        const result = apply(undefined, { type: 'ensure', entryId: 'ping', scriptType: 'demo_ping', historyLimit: 3, seed: { h: [historyItem(4), historyItem(1), historyItem(5), historyItem(2), historyItem(3)] } });
        const entry = result.entry!;

        expect(entry.h.map((x) => x.d?.['n'])).toEqual([3, 4, 5]);
        expect(entry.h.every((x) => x.rn === 0)).toBe(true);
      });

      it('should take the run counter and the fence only from the schedule', () => {
        const result = apply(undefined, { type: 'ensure', entryId: 'ping', scriptType: 'demo_ping', seed: { sc: 5, h: [historyItem(1)] } });

        expect(result.bot?.rc).toBe(1);
        expect(result.entry?.rn).toBe(1);
        expect(result.entry?.nk).toBe('nb/profile_abc/nbn/profile_abc_ping_r1');
      });

      it('should ignore the seed on an existing entry', () => {
        const result = apply(ensured(), { type: 'ensure', entryId: 'ping', scriptType: 'demo_ping', seed: { lsat: seedLsat, sc: 5, h: [historyItem(1)], pause: { reason: 'no_progress' } } });

        expect(result.changed).toBe(false);
        expect(result.entry?.sc).toBe(0);
        expect(result.entry?.h).toHaveLength(0);
        expect(result.entry?.pat).toBeUndefined();
      });

      it('should create a paused entry with no run', () => {
        const result = apply(undefined, { type: 'ensure', entryId: 'ping', scriptType: 'demo_ping', seed: { pause: { reason: 'no_progress', at: seedLat } } });

        expect(result.entry?.pat).toEqual(seedLat);
        expect(result.entry?.pr).toBe('no_progress');
        expect(result.entry?.rn).toBeUndefined();
        expect(result.createRuns).toHaveLength(0);
        expect(notificationTaskBotEntryStatus(result.entry!)).toBe(NotificationTaskBotEntryStatus.PAUSED);
      });

      it('should create a paused entry with its resume run when the pause has an until time', () => {
        const result = apply(undefined, { type: 'ensure', entryId: 'ping', scriptType: 'demo_ping', seed: { pause: { reason: 'no_progress', until: later } } });

        expect(result.entry?.pat).toEqual(now);
        expect(result.entry?.pu).toEqual(later);
        expect(result.createRuns).toHaveLength(1);
        expect(result.createRuns[0]).toMatchObject({ runNumber: 1, sendAt: later, explicit: false, trigger: NotificationTaskBotRunTrigger.SCHEDULED });
        expect(notificationTaskBotEntryStatus(result.entry!)).toBe(NotificationTaskBotEntryStatus.PAUSED);
      });

      it('should throw on an invalid sc', () => {
        expect(() => apply(undefined, { type: 'ensure', entryId: 'ping', scriptType: 'demo_ping', seed: { sc: -1 } })).toThrow();
        expect(() => apply(undefined, { type: 'ensure', entryId: 'ping', scriptType: 'demo_ping', seed: { sc: 1.5 } })).toThrow();
      });
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

    it('should schedule a not-before run at a date by default', () => {
      const result = apply(ensured(), { type: 'schedule', entryId: 'ping', at: later });
      expect(result.createRuns[0]).toMatchObject({ sendAt: later, explicit: false });
    });

    it('should schedule an explicit run when requested', () => {
      const result = apply(ensured(), { type: 'schedule', entryId: 'ping', at: later, explicit: true });
      expect(result.createRuns[0]).toMatchObject({ sendAt: later, explicit: true });
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
      expect(resumed.entry?.rpr).toBe('manual');
      expect(resumed.createRuns[0].runNumber).toBe(2);
    });

    describe('until', () => {
      function pausedUntil(until = later) {
        return apply(ensured(), { type: 'pause', entryId: 'ping', pause: { reason: 'manual', until } });
      }

      it('should cancel the live run and issue a resume run at the until time', () => {
        const result = pausedUntil();

        expect(result.entry?.pu).toEqual(later);
        expect(result.entry?.rn).toBe(2);
        expect(result.deleteTaskKeys).toEqual(['nb/profile_abc/nbn/profile_abc_ping_r1']);
        expect(result.createRuns[0]).toMatchObject({ runNumber: 2, sendAt: later, explicit: false, trigger: NotificationTaskBotRunTrigger.SCHEDULED });
        expect(result.bot?.nat).toEqual(later);
        expect(notificationTaskBotEntryStatus(result.entry!)).toBe(NotificationTaskBotEntryStatus.PAUSED);
      });

      it('should clear pu and cancel the resume run when paused again without an until time', () => {
        const result = apply(pausedUntil().bot as NotificationTaskBot, { type: 'pause', entryId: 'ping', pause: { reason: 'manual' } });

        expect(result.entry?.pu).toBeNull();
        expect(result.entry?.rn).toBeNull();
        expect(result.deleteTaskKeys).toEqual(['nb/profile_abc/nbn/profile_abc_ping_r2']);
        expect(result.createRuns).toHaveLength(0);
      });

      it('should cancel the resume run and schedule a run due now when resumed', () => {
        const result = apply(pausedUntil().bot as NotificationTaskBot, { type: 'pause', entryId: 'ping', pause: false });

        expect(result.entry?.pat).toBeNull();
        expect(result.entry?.pu).toBeNull();
        expect(result.entry?.rpr).toBe('manual');
        expect(result.deleteTaskKeys).toEqual(['nb/profile_abc/nbn/profile_abc_ping_r2']);
        expect(result.createRuns[0]).toMatchObject({ runNumber: 3, sendAt: now, explicit: false });
      });

      it('should re-issue the resume run when the entry is enabled again', () => {
        const disabled = apply(pausedUntil().bot as NotificationTaskBot, { type: 'state', entryId: 'ping', state: NotificationTaskBotEntryState.DISABLED });

        expect(disabled.entry?.rn).toBeNull();
        expect(disabled.entry?.pu).toEqual(later);

        const enabled = apply(disabled.bot as NotificationTaskBot, { type: 'state', entryId: 'ping', state: NotificationTaskBotEntryState.ENABLED });

        expect(enabled.createRuns).toHaveLength(1);
        expect(enabled.createRuns[0]).toMatchObject({ runNumber: 3, sendAt: later, explicit: false });
        expect(notificationTaskBotEntryStatus(enabled.entry!)).toBe(NotificationTaskBotEntryStatus.PAUSED);
      });

      it('should re-issue a missing resume run on ensure', () => {
        const cancelled = apply(pausedUntil().bot as NotificationTaskBot, { type: 'cancel', entryId: 'ping' });
        const result = apply(cancelled.bot as NotificationTaskBot, { type: 'ensure', entryId: 'ping', scriptType: 'demo_ping' });

        expect(result.createRuns[0]).toMatchObject({ runNumber: 3, sendAt: later });
      });

      it('should re-issue a lost resume run on repair without recording LOST or a failure', () => {
        const result = apply(pausedUntil().bot as NotificationTaskBot, { type: 'repair', entryId: 'ping', runNumber: 2 });

        expect(result.entry?.h).toHaveLength(0);
        expect(result.entry?.fc).toBe(0);
        expect(result.entry?.pat).toEqual(now);
        expect(result.createRuns[0]).toMatchObject({ runNumber: 3, sendAt: later });
        expect(result.deleteTaskKeys).toHaveLength(0);
      });
    });
  });

  describe('expirePause', () => {
    const until = new Date(now.getTime() + 60000);

    function pausedUntil() {
      return apply(ensured(), { type: 'pause', entryId: 'ping', pause: { reason: 'limit', until } }).bot as NotificationTaskBot;
    }

    it('should resume the entry and keep the live run when the pause expired', () => {
      const result = apply(pausedUntil(), { type: 'expirePause', entryId: 'ping', runNumber: 2 }, later);

      expect(result.changed).toBe(true);
      expect(result.entry?.pat).toBeNull();
      expect(result.entry?.pu).toBeNull();
      expect(result.entry?.pr).toBeNull();
      expect(result.entry?.rpr).toBe('limit');
      expect(result.entry?.rn).toBe(2);
      expect(result.createRuns).toHaveLength(0);
      expect(result.deleteTaskKeys).toHaveLength(0);
      expect(notificationTaskBotEntryStatus(result.entry!)).toBe(NotificationTaskBotEntryStatus.SCHEDULED);
    });

    it('should be a no-op before the until time', () => {
      const result = apply(pausedUntil(), { type: 'expirePause', entryId: 'ping', runNumber: 2 }, now);

      expect(result.changed).toBe(false);
      expect(result.entry?.pat).toEqual(now);
    });

    it('should be fenced off when the run number does not match', () => {
      const result = apply(pausedUntil(), { type: 'expirePause', entryId: 'ping', runNumber: 1 }, later);

      expect(result.fenced).toBe(true);
      expect(result.changed).toBe(false);
    });
  });

  describe('deferRun', () => {
    it('should end the live run without history and hand over to a SCHEDULED not-before run', () => {
      const manual = apply(ensured(), { type: 'schedule', entryId: 'ping', trigger: NotificationTaskBotRunTrigger.MANUAL }).bot as NotificationTaskBot;
      const result = apply(manual, { type: 'deferRun', entryId: 'ping', runNumber: 2, at: later });

      expect(result.entry?.h).toHaveLength(0);
      expect(result.entry?.rn).toBe(3);
      expect(result.createRuns).toHaveLength(1);
      expect(result.createRuns[0]).toMatchObject({ runNumber: 3, trigger: NotificationTaskBotRunTrigger.SCHEDULED, sendAt: later, explicit: false });
      expect(result.deleteTaskKeys).toHaveLength(0); // the deferred run's own task is marked done by the handler
      expect(result.bot?.nat).toEqual(later);
    });

    it('should keep rpr and the failure count', () => {
      let bot = apply(ensured(), { type: 'pause', entryId: 'ping', pause: { reason: 'limit' } }).bot as NotificationTaskBot;
      bot = apply(bot, { type: 'pause', entryId: 'ping', pause: false }).bot as NotificationTaskBot;
      bot = { ...bot, e: bot.e.map((x) => ({ ...x, fc: 2 })) };

      const result = apply(bot, { type: 'deferRun', entryId: 'ping', runNumber: 2, at: later });

      expect(result.entry?.rpr).toBe('limit');
      expect(result.entry?.fc).toBe(2);
    });

    it('should be fenced off when the run number does not match', () => {
      const result = apply(ensured(), { type: 'deferRun', entryId: 'ping', runNumber: 7, at: later });

      expect(result.fenced).toBe(true);
      expect(result.changed).toBe(false);
      expect(result.createRuns).toHaveLength(0);
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

    it('should apply the default minimum run interval', () => {
      const result = apply(ensured(), { type: 'completeRun', entryId: 'ping', runNumber: 1, trigger: NotificationTaskBotRunTrigger.SCHEDULED, nextRunAt: now });
      expect(result.createRuns[0]).toMatchObject({ sendAt: new Date(now.getTime() + DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_MINIMUM_RUN_INTERVAL), explicit: false });
    });

    it('should apply the default minimum run interval to an explicit next run', () => {
      const result = apply(ensured(), { type: 'completeRun', entryId: 'ping', runNumber: 1, trigger: NotificationTaskBotRunTrigger.SCHEDULED, nextRunAtExplicit: now });
      expect(result.createRuns[0]).toMatchObject({ sendAt: new Date(now.getTime() + DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_MINIMUM_RUN_INTERVAL), explicit: true });
    });

    it('should schedule at now when the minimum run interval is 0', () => {
      const result = apply(ensured(), { type: 'completeRun', entryId: 'ping', runNumber: 1, trigger: NotificationTaskBotRunTrigger.SCHEDULED, nextRunAt: now, minimumRunInterval: 0 });
      expect(result.createRuns[0]).toMatchObject({ sendAt: now });
    });

    describe('failures', () => {
      function completeFailed(bot: NotificationTaskBot, extra?: Partial<NotificationTaskBotChange>) {
        const rn = bot.e[0].rn as number;
        return apply(bot, { type: 'completeRun', entryId: 'ping', runNumber: rn, trigger: NotificationTaskBotRunTrigger.SCHEDULED, outcome: NotificationTaskBotRunOutcome.FAILED, nextRunAt: later, maxConsecutiveFailures: 2, ...extra } as NotificationTaskBotChange);
      }

      it('should add 1 to the failure count', () => {
        const result = completeFailed(ensured());

        expect(result.entry?.fc).toBe(1);
        expect(result.entry?.pat).toBeUndefined();
        expect(result.createRuns).toHaveLength(1);
      });

      it('should pause with the failed reason at the failure budget and issue no run', () => {
        const result = completeFailed(completeFailed(ensured()).bot as NotificationTaskBot);

        expect(result.entry?.fc).toBe(2);
        expect(result.entry?.pr).toBe('failed');
        expect(result.entry?.rn).toBeNull();
        expect(result.createRuns).toHaveLength(0);
      });

      it("should keep the script's own pause reason", () => {
        const result = completeFailed(completeFailed(ensured()).bot as NotificationTaskBot, { pause: { reason: 'no_progress' } });
        expect(result.entry?.pr).toBe('no_progress');
      });

      it('should reset the failure count on any other outcome', () => {
        const failed = completeFailed(ensured()).bot as NotificationTaskBot;
        const result = apply(failed, { type: 'completeRun', entryId: 'ping', runNumber: 2, trigger: NotificationTaskBotRunTrigger.SCHEDULED, outcome: NotificationTaskBotRunOutcome.SUBMITTED });

        expect(result.entry?.fc).toBe(0);
      });
    });

    it('should pause until a time with a resume run instead of a next run', () => {
      const result = apply(ensured(), { type: 'completeRun', entryId: 'ping', runNumber: 1, trigger: NotificationTaskBotRunTrigger.SCHEDULED, nextRunAt: now, pause: { reason: 'limit', until: later } });

      expect(result.entry?.pu).toEqual(later);
      expect(result.createRuns).toHaveLength(1);
      expect(result.createRuns[0]).toMatchObject({ runNumber: 2, sendAt: later });
    });

    it('should issue no resume run when it also disables the entry', () => {
      const result = apply(ensured(), { type: 'completeRun', entryId: 'ping', runNumber: 1, trigger: NotificationTaskBotRunTrigger.SCHEDULED, pause: { reason: 'limit', until: later }, disable: true });

      expect(result.entry?.pu).toEqual(later);
      expect(result.entry?.rn).toBeNull();
      expect(result.createRuns).toHaveLength(0);
    });

    it('should clear rpr', () => {
      let bot = apply(ensured(), { type: 'pause', entryId: 'ping', pause: { reason: 'limit' } }).bot as NotificationTaskBot;
      bot = apply(bot, { type: 'pause', entryId: 'ping', pause: false }).bot as NotificationTaskBot;

      expect(bot.e[0].rpr).toBe('limit');

      const result = apply(bot, { type: 'completeRun', entryId: 'ping', runNumber: 2, trigger: NotificationTaskBotRunTrigger.SCHEDULED });
      expect(result.entry?.rpr).toBeNull();
    });

    describe('remove', () => {
      it('should remove the entry without history or a next run', () => {
        const result = apply(ensured(), { type: 'completeRun', entryId: 'ping', runNumber: 1, trigger: NotificationTaskBotRunTrigger.SCHEDULED, nextRunAt: later, remove: true });

        expect(result.changed).toBe(true);
        expect(result.bot?.e).toHaveLength(0);
        expect(result.bot?.rc).toBe(1);
        expect(result.bot?.nat).toBeNull();
        expect(result.entry).toBeUndefined();
        expect(result.createRuns).toHaveLength(0);
        expect(result.deleteTaskKeys).toHaveLength(0); // the run's own task is marked done by the handler
      });

      it('should be fenced off when the run number does not match', () => {
        const result = apply(ensured(), { type: 'completeRun', entryId: 'ping', runNumber: 7, trigger: NotificationTaskBotRunTrigger.SCHEDULED, remove: true });

        expect(result.fenced).toBe(true);
        expect(result.bot?.e).toHaveLength(1);
      });
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

describe('owner opt-outs', () => {
  const group = 'reminders';
  const optOutGroupKeyForScriptType = (t: string) => (t === 'optional' || t === 'optional_b' ? group : undefined);

  function deepFreeze<T>(value: T): T {
    if (value != null && typeof value === 'object' && !(value instanceof Date)) {
      Object.values(value).forEach(deepFreeze);
      Object.freeze(value);
    }

    return value;
  }

  function applyWith(bot: Maybe<NotificationTaskBot>, change: NotificationTaskBotChange, at = now) {
    return applyNotificationTaskBotChange({ bot, model, change, now: at, optOutGroupKeyForScriptType });
  }

  function applyAllWith(bot: Maybe<NotificationTaskBot>, changes: NotificationTaskBotChange[], at = now) {
    return applyNotificationTaskBotChanges({ bot, model, changes, now: at, optOutGroupKeyForScriptType });
  }

  /**
   * A bot with an opt-out-able entry (`a`), a second opt-out-able entry in the same group (`b`) and a required entry in
   * the same topic (`r`), each with a live run.
   */
  function groupBot() {
    return applyAllWith(undefined, [
      { type: 'ensure', entryId: 'a', scriptType: 'optional' },
      { type: 'ensure', entryId: 'b', scriptType: 'optional_b' },
      { type: 'ensure', entryId: 'r', scriptType: 'required' }
    ]).bot as NotificationTaskBot;
  }

  function optedOutBot() {
    return applyWith(groupBot(), { type: 'optOut', group, optOut: true }, later).bot as NotificationTaskBot;
  }

  function expectInvariant(bot: Maybe<NotificationTaskBot>) {
    bot?.e.forEach((x) => {
      if (x.oat != null) {
        expect(x.rn ?? null).toBeNull();
        expect(x.nk ?? null).toBeNull();
      }
    });
  }

  describe('optOut', () => {
    it("should set oat on the group's opt-out-able entries and cancel their runs", () => {
      const bot = deepFreeze(groupBot());
      const result = applyWith(bot, { type: 'optOut', group, optOut: true }, later);

      expect(result.changed).toBe(true);
      expect(notificationTaskBotEntry(result.bot, 'a')?.oat).toEqual(later);
      expect(notificationTaskBotEntry(result.bot, 'b')?.oat).toEqual(later);
      expect(notificationTaskBotEntry(result.bot, 'a')?.rn).toBeNull();
      expect(result.deleteTaskKeys).toEqual(['nb/profile_abc/nbn/profile_abc_a_r1', 'nb/profile_abc/nbn/profile_abc_b_r2']);
      expect(result.createRuns).toHaveLength(0);
      expectInvariant(result.bot);
    });

    it('should leave the required entry in the same topic untouched', () => {
      const bot = groupBot();
      const result = applyWith(bot, { type: 'optOut', group, optOut: true }, later);
      const required = notificationTaskBotEntry(result.bot, 'r');

      expect(required).toBe(notificationTaskBotEntry(bot, 'r'));
      expect(required?.oat).toBeUndefined();
      expect(required?.rn).toBe(3);
      expect(result.bot?.nat).toEqual(now);
    });

    it('should report a bot-level result', () => {
      const result = applyWith(groupBot(), { type: 'optOut', group, optOut: true });

      expect(result.entry).toBeUndefined();
      expect(result.unknownEntry).toBe(false);
      expect(result.fenced).toBe(false);
    });

    it('should report OPTED_OUT as the entry status', () => {
      const entry = notificationTaskBotEntry(optedOutBot(), 'a');
      expect(notificationTaskBotEntryStatus(entry as NonNullable<typeof entry>)).toBe(NotificationTaskBotEntryStatus.OPTED_OUT);
    });

    it('should be a no-op on a missing bot', () => {
      const result = applyWith(undefined, { type: 'optOut', group, optOut: true });

      expect(result.changed).toBe(false);
      expect(result.bot).toBeUndefined();
    });

    it('should be a no-op without the resolver', () => {
      const result = apply(groupBot(), { type: 'optOut', group, optOut: true });

      expect(result.changed).toBe(false);
      expect(result.deleteTaskKeys).toHaveLength(0);
    });

    it('should be a no-op when the group is already opted out', () => {
      const result = applyWith(optedOutBot(), { type: 'optOut', group, optOut: true });
      expect(result.changed).toBe(false);
    });
  });

  describe('optIn', () => {
    it('should clear oat and schedule a run due now', () => {
      const bot = deepFreeze(optedOutBot());
      const result = applyWith(bot, { type: 'optOut', group, optOut: false }, later);
      const entry = notificationTaskBotEntry(result.bot, 'a');

      expect(entry?.oat).toBeNull();
      expect(entry?.rn).toBe(4);
      expect(result.createRuns.map((x) => x.entryId)).toEqual(['a', 'b']);
      expect(result.createRuns[0]).toMatchObject({ trigger: NotificationTaskBotRunTrigger.SCHEDULED, sendAt: later, explicit: false });
    });

    it('should re-issue the resume run of an entry paused until a time', () => {
      let bot = groupBot();
      bot = applyWith(bot, { type: 'pause', entryId: 'a', pause: { reason: 'manual', until: later } }).bot as NotificationTaskBot;
      bot = applyWith(bot, { type: 'optOut', group, optOut: true }).bot as NotificationTaskBot;

      const optedOut = notificationTaskBotEntry(bot, 'a');
      expect(optedOut?.rn).toBeNull();
      expect(optedOut?.pu).toEqual(later);

      const result = applyWith(bot, { type: 'optOut', group, optOut: false });
      const run = result.createRuns.find((x) => x.entryId === 'a');

      expect(run).toMatchObject({ sendAt: later, explicit: false });
      expect(notificationTaskBotEntryStatus(notificationTaskBotEntry(result.bot, 'a') as NotificationTaskBotEmbeddedScriptEntry)).toBe(NotificationTaskBotEntryStatus.PAUSED);
    });

    it('should not schedule a paused or disabled entry', () => {
      let bot = optedOutBot();
      bot = applyWith(bot, { type: 'pause', entryId: 'a', pause: { reason: 'manual' } }).bot as NotificationTaskBot;
      bot = applyWith(bot, { type: 'state', entryId: 'b', state: NotificationTaskBotEntryState.DISABLED }).bot as NotificationTaskBot;

      const result = applyWith(bot, { type: 'optOut', group, optOut: false });

      expect(result.changed).toBe(true);
      expect(result.createRuns).toHaveLength(0);
      expect(notificationTaskBotEntry(result.bot, 'a')?.oat).toBeNull();
      expect(notificationTaskBotEntryStatus(notificationTaskBotEntry(result.bot, 'a') as NotificationTaskBotEmbeddedScriptEntry)).toBe(NotificationTaskBotEntryStatus.PAUSED);
    });
  });

  describe('ensure', () => {
    it('should create a new entry opted out when a sibling in its group is opted out', () => {
      const bot = deepFreeze(optedOutBot());
      const result = applyWith(bot, { type: 'ensure', entryId: 'c', scriptType: 'optional' });

      expect(result.entry?.oat).toEqual(later);
      expect(result.entry?.rn).toBeUndefined();
      expect(result.createRuns).toHaveLength(0);
      expect(result.deleteTaskKeys).toHaveLength(0);
      expectInvariant(result.bot);
    });

    it('should not opt out a new entry whose group has no opted-out sibling', () => {
      const result = applyWith(groupBot(), { type: 'ensure', entryId: 'c', scriptType: 'optional' });

      expect(result.entry?.oat).toBeUndefined();
      expect(result.createRuns).toHaveLength(1);
    });

    it('should clear the opt-out of an entry whose script no longer allows owner opt-out', () => {
      const bot = optedOutBot();
      const result = applyNotificationTaskBotChange({ bot, model, now, change: { type: 'ensure', entryId: 'a', scriptType: 'optional' }, optOutGroupKeyForScriptType: () => undefined });

      expect(result.entry?.oat).toBeNull();
      expect(result.entry?.rn).toBe(4);
    });

    it('should set the owner when provided', () => {
      const result = applyWith(undefined, { type: 'ensure', entryId: 'a', scriptType: 'optional', owner: 'pr/abc' });
      expect(result.bot?.o).toBe('pr/abc');
    });

    it('should leave the owner alone when not provided', () => {
      const bot = applyWith(undefined, { type: 'ensure', entryId: 'a', scriptType: 'optional', owner: 'pr/abc' }).bot as NotificationTaskBot;
      const result = applyWith(bot, { type: 'ensure', entryId: 'a', scriptType: 'optional' });

      expect(result.changed).toBe(false);
      expect(result.bot?.o).toBe('pr/abc');
    });
  });

  describe('owner', () => {
    it('should set the owner and keep every oat', () => {
      const bot = deepFreeze(optedOutBot());
      const result = applyWith(bot, { type: 'owner', owner: 'pr/other' });

      expect(result.changed).toBe(true);
      expect(result.bot?.o).toBe('pr/other');
      expect(result.bot?.e).toEqual(bot.e);
      expect(result.entry).toBeUndefined();
      expect(result.unknownEntry).toBe(false);
    });

    it('should be a no-op on a missing bot', () => {
      expect(applyWith(undefined, { type: 'owner', owner: 'pr/abc' }).bot).toBeUndefined();
    });
  });

  describe('runnability', () => {
    it('should never issue a run for an opted-out entry', () => {
      const bot = optedOutBot();
      const changes: NotificationTaskBotChange[] = [
        { type: 'schedule', entryId: 'a' },
        { type: 'schedule', entryId: 'a', at: later },
        { type: 'state', entryId: 'a', state: NotificationTaskBotEntryState.ENABLED },
        { type: 'pause', entryId: 'a', pause: false },
        { type: 'completeRun', entryId: 'a', runNumber: 1, trigger: NotificationTaskBotRunTrigger.SCHEDULED, nextRunAt: later },
        { type: 'repair', entryId: 'a', runNumber: 1 },
        { type: 'ensure', entryId: 'a', scriptType: 'optional', schedule: 'now' }
      ];

      changes.forEach((change) => {
        const result = applyWith(bot, change);
        expect(result.createRuns).toHaveLength(0);
        expect(notificationTaskBotEntry(result.bot, 'a')?.oat).toEqual(later);
        expectInvariant(result.bot);
      });
    });

    it('should not issue a repair run for an entry that is no longer runnable', () => {
      // an entry with a live run whose oat was set out of band, which repair must never revive
      const bot = groupBot();
      const corrupted: NotificationTaskBot = { ...bot, e: bot.e.map((x) => (x.i === 'a' ? { ...x, oat: later } : x)) };
      const result = applyWith(corrupted, { type: 'repair', entryId: 'a', runNumber: 1 });

      expect(result.changed).toBe(true);
      expect(result.createRuns).toHaveLength(0);
      expect(notificationTaskBotEntry(result.bot, 'a')?.rn).toBeNull();
    });
  });

  describe('batches', () => {
    it('[ensure, optOut] should create and delete no runs', () => {
      const result = applyAllWith(groupBot(), [
        { type: 'ensure', entryId: 'c', scriptType: 'optional' },
        { type: 'optOut', group, optOut: true }
      ]);

      expect(result.createRuns).toHaveLength(0);
      expect(result.deleteTaskKeys).toEqual(['nb/profile_abc/nbn/profile_abc_a_r1', 'nb/profile_abc/nbn/profile_abc_b_r2']);
    });

    it('[ensure, optOut] on a new bot should create and delete no runs', () => {
      const result = applyAllWith(undefined, [
        { type: 'ensure', entryId: 'a', scriptType: 'optional' },
        { type: 'optOut', group, optOut: true }
      ]);

      expect(result.createRuns).toHaveLength(0);
      expect(result.deleteTaskKeys).toHaveLength(0);
    });

    it('[optOut, optIn] should delete the old task and create a new one', () => {
      const result = applyAllWith(groupBot(), [
        { type: 'optOut', group, optOut: true },
        { type: 'optOut', group, optOut: false }
      ]);

      expect(result.deleteTaskKeys).toEqual(['nb/profile_abc/nbn/profile_abc_a_r1', 'nb/profile_abc/nbn/profile_abc_b_r2']);
      expect(result.createRuns.map((x) => x.runNumber)).toEqual([4, 5]);
    });

    it('should keep the entry result of the last entry-level change when a bot-level change trails it', () => {
      const result = applyAllWith(groupBot(), [
        { type: 'schedule', entryId: 'a' },
        { type: 'optOut', group, optOut: true }
      ]);

      expect(result.entry?.i).toBe('a');
      expect(result.entry?.oat).toEqual(now);
      expect(result.entry?.rn).toBeNull();
      expect(result.unknownEntry).toBe(false);
    });
  });
});
