import { describe, expect, it } from 'vitest';
import { type NotificationTaskBot, type NotificationTaskBotEmbeddedScriptEntry, NotificationTaskBotEntryState } from './notification.taskbot';
import { notificationTaskBotOwnerOptOutGroups } from './notification.taskbot.optout';
import { appNotificationTaskBotScriptConfigService, notificationTaskBotScriptConfigRecord } from './notification.taskbot.script';

const createdAt = new Date('2026-01-02T00:00:00.000Z');
const firstOptOut = new Date('2026-01-03T00:00:00.000Z');
const secondOptOut = new Date('2026-01-04T00:00:00.000Z');

const reminders = { key: 'reminders', name: 'Reminders', description: 'Reminder emails.', sortOrder: 2 };
const digests = { key: 'digests', name: 'Digests', sortOrder: 1 };
const alerts = { key: 'alerts', name: 'Alerts' };
const requiredOnly = { key: 'required_only', name: 'Required Only' };

const scriptConfigService = appNotificationTaskBotScriptConfigService(
  notificationTaskBotScriptConfigRecord([
    { scriptType: 'reminder_a', group: reminders, allowOwnerOptOut: true },
    { scriptType: 'reminder_b', group: reminders, allowOwnerOptOut: true },
    { scriptType: 'reminder_required', group: reminders },
    { scriptType: 'digest', group: digests, allowOwnerOptOut: true },
    { scriptType: 'alert', group: alerts, allowOwnerOptOut: true },
    { scriptType: 'required', group: requiredOnly }
  ])
);

function entry(i: string, t: string, oat?: Date): NotificationTaskBotEmbeddedScriptEntry {
  return { i, t, s: NotificationTaskBotEntryState.ENABLED, cat: createdAt, sc: 0, fc: 0, h: [], oat };
}

describe('notificationTaskBotOwnerOptOutGroups()', () => {
  const bot: Pick<NotificationTaskBot, 'e'> = {
    e: [entry('a', 'reminder_a', secondOptOut), entry('b', 'reminder_b', firstOptOut), entry('c', 'reminder_required'), entry('d', 'digest'), entry('e', 'required'), entry('f', 'unregistered')]
  };

  const groups = notificationTaskBotOwnerOptOutGroups({ bot, scriptConfigService });

  it('should list only the groups that have an opt-out-able entry on the bot', () => {
    expect(groups.map((x) => x.key)).toEqual(['digests', 'reminders']);
  });

  it('should not list a group that only holds a required script, or a group with no entry on the bot', () => {
    expect(groups.find((x) => x.key === 'required_only')).toBeUndefined();
    expect(groups.find((x) => x.key === 'alerts')).toBeUndefined();
  });

  it('should use the earliest entry opt-out as the group opt-out', () => {
    expect(groups.find((x) => x.key === 'reminders')?.optOutAt).toEqual(firstOptOut);
  });

  it('should leave optOutAt unset for a group with no opted-out entries', () => {
    const digest = groups.find((x) => x.key === 'digests');
    expect(digest?.optOutAt).toBeUndefined();
    expect(digest && 'optOutAt' in digest).toBe(false);
  });

  it('should expose the group details but never the entries or script types', () => {
    expect(groups.find((x) => x.key === 'reminders')).toEqual({ ...reminders, optOutAt: firstOptOut });
  });

  it('should return an empty list for a missing bot', () => {
    expect(notificationTaskBotOwnerOptOutGroups({ bot: undefined, scriptConfigService })).toEqual([]);
  });
});
