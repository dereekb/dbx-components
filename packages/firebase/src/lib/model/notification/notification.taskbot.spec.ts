import { describe, expect, it } from 'vitest';
import { isFirestoreModelId } from '../../common';
import { isNotificationTaskBotEntryId, notificationTaskBotRunNotificationTaskUniqueId } from './notification.id';
import { type NotificationTaskBot, notificationTaskBotConverter, notificationTaskBotKeyForModel, NotificationTaskBotEntryState, NotificationTaskBotRunOutcome, NotificationTaskBotRunTrigger } from './notification.taskbot';
import { NOTIFICATION_TASK_BOT_RUN_NOTIFICATION_TASK_TYPE, notificationTaskBotRunNotificationTaskKey, notificationTaskBotRunNotificationTaskTemplate } from './notification.taskbot.task';

const createdAt = new Date('2026-01-02T03:04:05.000Z');
const runAt = new Date('2026-01-02T04:04:05.000Z');

describe('notificationTaskBotConverter', () => {
  const model: NotificationTaskBot = {
    cat: createdAt,
    m: 'profile/abc_123',
    rc: 4,
    nat: runAt,
    e: [
      {
        i: 'ping',
        t: 'demo_ping',
        s: NotificationTaskBotEntryState.ENABLED,
        cat: createdAt,
        d: { c: 2, nested: { a: 1, b: undefined } },
        rn: 4,
        nk: 'nb/profile_abc_123/nbn/profile_abc_123_ping_r4',
        nat: runAt,
        lat: createdAt,
        lsat: createdAt,
        lsr: 3,
        sc: 2,
        fc: 0,
        h: [
          { at: createdAt, rn: 2, tr: NotificationTaskBotRunTrigger.SCHEDULED, o: NotificationTaskBotRunOutcome.SUBMITTED, d: { x: 'y', z: undefined } },
          { at: runAt, rn: 3, tr: NotificationTaskBotRunTrigger.FORCED, o: NotificationTaskBotRunOutcome.LOST }
        ]
      }
    ]
  };

  it('should round-trip a bot with nested history', () => {
    const data = notificationTaskBotConverter.mapFunctions.to(model);
    const restored = notificationTaskBotConverter.mapFunctions.from(data);

    expect(restored.m).toBe(model.m);
    expect(restored.rc).toBe(4);
    expect(restored.nat).toEqual(runAt);
    expect(restored.e).toHaveLength(1);

    const entry = restored.e[0];
    expect(entry.i).toBe('ping');
    expect(entry.rn).toBe(4);
    expect(entry.lsat).toEqual(createdAt);
    expect(entry.h).toHaveLength(2);
    expect(entry.h[1].o).toBe(NotificationTaskBotRunOutcome.LOST);
    expect(entry.h[1].tr).toBe(NotificationTaskBotRunTrigger.FORCED);
  });

  it('should strip nested undefined values from the entry data and history data', () => {
    const data = notificationTaskBotConverter.mapFunctions.to(model) as any;
    const entry = data.e[0];

    expect(entry.d).toEqual({ c: 2, nested: { a: 1 } });
    expect('b' in entry.d.nested).toBe(false);
    expect(entry.h[0].d).toEqual({ x: 'y' });
  });

  it('should not store unset optional entry fields', () => {
    const data = notificationTaskBotConverter.mapFunctions.to({ cat: createdAt, m: 'profile/abc', rc: 0, e: [{ i: 'a', t: 't', s: NotificationTaskBotEntryState.ENABLED, cat: createdAt, sc: 0, fc: 0, h: [] }] }) as any;
    const entry = data.e[0];

    expect(entry.rn).toBeUndefined();
    expect(entry.nk).toBeUndefined();
  });
});

describe('notificationTaskBotKeyForModel()', () => {
  it('should return the bot key for the model', () => {
    expect(notificationTaskBotKeyForModel('profile/abc')).toBe('ntb/profile_abc');
  });
});

describe('isNotificationTaskBotEntryId()', () => {
  it('should accept lowercase letters, digits and dashes', () => {
    expect(isNotificationTaskBotEntryId('ping')).toBe(true);
    expect(isNotificationTaskBotEntryId('follow-up-2')).toBe(true);
  });

  it('should reject underscores, uppercase and empty ids', () => {
    expect(isNotificationTaskBotEntryId('follow_up')).toBe(false);
    expect(isNotificationTaskBotEntryId('Ping')).toBe(false);
    expect(isNotificationTaskBotEntryId('')).toBe(false);
  });
});

describe('notificationTaskBotRunNotificationTaskUniqueId()', () => {
  it('should produce valid firestore model ids, even for model ids that contain underscores', () => {
    const id = notificationTaskBotRunNotificationTaskUniqueId('profile_abc_123', 'ping', 12);
    expect(id).toBe('profile_abc_123_ping_r12');
    expect(isFirestoreModelId(id)).toBe(true);
  });
});

describe('notificationTaskBotRunNotificationTaskTemplate()', () => {
  it('should create a unique task in the attached model box with the run data', () => {
    const template = notificationTaskBotRunNotificationTaskTemplate({
      model: 'profile/abc',
      botKey: 'ntb/profile_abc',
      botId: 'profile_abc',
      entryId: 'ping',
      scriptType: 'demo_ping',
      runNumber: 3,
      trigger: NotificationTaskBotRunTrigger.MANUAL,
      sendAt: runAt
    });

    expect(template.notificationModel).toBe('profile/abc');
    expect(template.unique).toBe('profile_abc_ping_r3');
    expect(template.sat).toEqual(runAt);
    expect(template.n.t).toBe(NOTIFICATION_TASK_BOT_RUN_NOTIFICATION_TASK_TYPE);
    expect(template.n.m).toBe('ntb/profile_abc');
    expect(template.n.d).toEqual({ b: 'profile_abc', i: 'ping', t: 'demo_ping', rn: 3, tr: NotificationTaskBotRunTrigger.MANUAL, sa: runAt.getTime() });
  });

  it('should compute the run task key', () => {
    expect(notificationTaskBotRunNotificationTaskKey({ model: 'profile/abc', botId: 'profile_abc', entryId: 'ping', runNumber: 3 })).toBe('nb/profile_abc/nbn/profile_abc_ping_r3');
  });
});
