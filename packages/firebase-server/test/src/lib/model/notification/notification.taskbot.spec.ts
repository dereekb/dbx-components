import { describe, expect, it } from 'vitest';
import { type NotificationTaskBot, type NotificationTaskBotEmbeddedScriptEntry, NotificationTaskBotEntryState, NotificationTaskBotEntryStatus, NotificationTaskBotRunOutcome, NotificationTaskBotRunTrigger } from '@dereekb/firebase';
import { notificationTaskBotLiveRunTaskKey, notificationTaskBotRunTaskData } from './notification.taskbot';
import { expectNotificationTaskBotEntryHistory, expectNotificationTaskBotEntryStatus } from './notification.taskbot.expect';

function makeEntry(entry: Partial<NotificationTaskBotEmbeddedScriptEntry> = {}): NotificationTaskBotEmbeddedScriptEntry {
  return { i: 'a', t: 'test', s: NotificationTaskBotEntryState.ENABLED, cat: new Date(), sc: 0, fc: 0, h: [], ...entry };
}

function makeBot(entries: NotificationTaskBotEmbeddedScriptEntry[]): Pick<NotificationTaskBot, 'e'> {
  return { e: entries };
}

describe('notificationTaskBotLiveRunTaskKey()', () => {
  it("should return the entry's live run task key", () => {
    const bot = makeBot([makeEntry({ i: 'a', rn: 1, nk: 'nb/1/n/1' })]);
    expect(notificationTaskBotLiveRunTaskKey(bot, 'a')).toBe('nb/1/n/1');
  });

  it('should return undefined for a missing bot', () => {
    expect(notificationTaskBotLiveRunTaskKey(undefined, 'a')).toBeUndefined();
  });

  it('should return undefined for a missing entry', () => {
    expect(notificationTaskBotLiveRunTaskKey(makeBot([makeEntry({ i: 'a', nk: 'nb/1/n/1' })]), 'b')).toBeUndefined();
  });

  it('should return undefined for an entry with no live run', () => {
    expect(notificationTaskBotLiveRunTaskKey(makeBot([makeEntry({ i: 'a' })]), 'a')).toBeUndefined();
  });
});

describe('notificationTaskBotRunTaskData()', () => {
  it("should return the task's data", () => {
    const d = { tr: NotificationTaskBotRunTrigger.FORCED };
    expect(notificationTaskBotRunTaskData({ n: { d } })).toBe(d);
  });

  it('should return undefined for a missing task', () => {
    expect(notificationTaskBotRunTaskData(undefined)).toBeUndefined();
  });
});

describe('expectNotificationTaskBotEntryStatus()', () => {
  it('should pass when the status matches', () => {
    expectNotificationTaskBotEntryStatus(makeEntry({ rn: 1 }), NotificationTaskBotEntryStatus.SCHEDULED);
    expectNotificationTaskBotEntryStatus(makeEntry(), NotificationTaskBotEntryStatus.IDLE);
  });

  it('should throw when the status does not match', () => {
    expect(() => expectNotificationTaskBotEntryStatus(makeEntry(), NotificationTaskBotEntryStatus.SCHEDULED)).toThrow();
  });

  it('should throw when the entry is missing', () => {
    expect(() => expectNotificationTaskBotEntryStatus(undefined, NotificationTaskBotEntryStatus.IDLE)).toThrow();
  });
});

describe('expectNotificationTaskBotEntryHistory()', () => {
  const at = new Date();
  const entry = makeEntry({
    h: [
      { rn: 1, at, tr: NotificationTaskBotRunTrigger.SCHEDULED, o: NotificationTaskBotRunOutcome.SUBMITTED },
      { rn: 2, at, tr: NotificationTaskBotRunTrigger.FORCED, o: NotificationTaskBotRunOutcome.SKIPPED }
    ]
  });

  it('should pass with outcomes', () => {
    expectNotificationTaskBotEntryHistory(entry, [NotificationTaskBotRunOutcome.SUBMITTED, NotificationTaskBotRunOutcome.SKIPPED]);
  });

  it('should pass with partial items', () => {
    expectNotificationTaskBotEntryHistory(entry, [{ rn: 1 }, { tr: NotificationTaskBotRunTrigger.FORCED, o: NotificationTaskBotRunOutcome.SKIPPED }]);
  });

  it('should pass with a mix of outcomes and partial items', () => {
    expectNotificationTaskBotEntryHistory(entry, [NotificationTaskBotRunOutcome.SUBMITTED, { tr: NotificationTaskBotRunTrigger.FORCED }]);
  });

  it('should pass with an empty history for a missing entry', () => {
    expectNotificationTaskBotEntryHistory(undefined, []);
  });

  it('should throw when the length differs', () => {
    expect(() => expectNotificationTaskBotEntryHistory(entry, [NotificationTaskBotRunOutcome.SUBMITTED])).toThrow();
  });

  it('should throw when a field does not match', () => {
    expect(() => expectNotificationTaskBotEntryHistory(entry, [NotificationTaskBotRunOutcome.SUBMITTED, { tr: NotificationTaskBotRunTrigger.MANUAL }])).toThrow();
  });
});
