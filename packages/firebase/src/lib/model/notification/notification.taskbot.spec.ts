import { describe, expect, it } from 'vitest';
import { isFirestoreModelId } from '../../common';
import { isNotificationTaskBotEntryId, isNotificationTaskBotScriptGroupKey, notificationTaskBotRunNotificationTaskUniqueId } from './notification.id';
import { type NotificationTaskBot, notificationTaskBotConverter, notificationTaskBotKeyForModel, NotificationTaskBotEntryState, NotificationTaskBotRunOutcome, NotificationTaskBotRunTrigger } from './notification.taskbot';
import { NOTIFICATION_TASK_BOT_RUN_NOTIFICATION_TASK_TYPE, notificationTaskBotRunNotificationTaskKey, notificationTaskBotRunNotificationTaskTemplate } from './notification.taskbot.task';
import { uniqueNotificationTaskKey } from './notification.create';

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

  it('should round-trip the owner key and the entry opt-out date', () => {
    const optedOut: NotificationTaskBot = { ...model, o: 'pr/abc_123', e: [{ ...model.e[0], rn: null, nk: null, nat: null, oat: runAt }] };
    const restored = notificationTaskBotConverter.mapFunctions.from(notificationTaskBotConverter.mapFunctions.to(optedOut));

    expect(restored.o).toBe('pr/abc_123');
    expect(restored.e[0].oat).toEqual(runAt);
  });

  it('should round-trip the paused until date and the resumed pause reason', () => {
    const pausedUntil: NotificationTaskBot = { ...model, e: [{ ...model.e[0], pat: createdAt, pr: 'manual', pu: runAt, rpr: 'limit' }] };
    const restored = notificationTaskBotConverter.mapFunctions.from(notificationTaskBotConverter.mapFunctions.to(pausedUntil));

    expect(restored.e[0].pu).toEqual(runAt);
    expect(restored.e[0].rpr).toBe('limit');
  });

  it('should round-trip the entry and bot stalled dates', () => {
    const stalled: NotificationTaskBot = { ...model, e: [{ ...model.e[0], stl: runAt }], stl: runAt };
    const restored = notificationTaskBotConverter.mapFunctions.from(notificationTaskBotConverter.mapFunctions.to(stalled));

    expect(restored.e[0].stl).toEqual(runAt);
    expect(restored.stl).toEqual(runAt);
  });

  it('should not store unset optional entry fields', () => {
    const data = notificationTaskBotConverter.mapFunctions.to({ cat: createdAt, m: 'profile/abc', rc: 0, e: [{ i: 'a', t: 't', s: NotificationTaskBotEntryState.ENABLED, cat: createdAt, sc: 0, fc: 0, h: [] }] }) as any;
    const entry = data.e[0];

    expect(entry.rn).toBeUndefined();
    expect(entry.nk).toBeUndefined();
    expect(entry.oat).toBeUndefined();
    expect(entry.pu).toBeUndefined();
    expect(entry.rpr).toBeUndefined();
    expect(entry.stl).toBeUndefined();
    expect(data.o).toBeNull(); // top-level optional fields store null, unlike sub-object fields
    expect(data.stl).toBeNull();
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

describe('isNotificationTaskBotScriptGroupKey()', () => {
  it('should accept lowercase letters, digits, underscores and dashes', () => {
    expect(isNotificationTaskBotScriptGroupKey('ping_reminders')).toBe(true);
    expect(isNotificationTaskBotScriptGroupKey('email-2')).toBe(true);
  });

  it('should reject uppercase, spaces, empty and overlong keys', () => {
    expect(isNotificationTaskBotScriptGroupKey('Ping')).toBe(false);
    expect(isNotificationTaskBotScriptGroupKey('a b')).toBe(false);
    expect(isNotificationTaskBotScriptGroupKey('')).toBe(false);
    expect(isNotificationTaskBotScriptGroupKey('a'.repeat(41))).toBe(false);
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

  it("the run task key is the template's unique task location", () => {
    const input = { model: 'profile/abc', botKey: 'ntb/profile_abc', botId: 'profile_abc', entryId: 'ping', scriptType: 'demo_ping', runNumber: 3, trigger: NotificationTaskBotRunTrigger.MANUAL, sendAt: runAt };
    const template = notificationTaskBotRunNotificationTaskTemplate(input);

    expect(notificationTaskBotRunNotificationTaskKey(input)).toBe(uniqueNotificationTaskKey({ notificationModel: template.notificationModel, uniqueId: template.unique as string }));
  });
});
